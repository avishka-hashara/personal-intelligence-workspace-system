-- Migration: 0010_milestone_status_view.sql
-- Create v_milestone_status view to dynamically derive milestone execution status

CREATE OR REPLACE VIEW v_milestone_status AS
WITH task_stats AS (
    SELECT
        t.milestone_id,
        COUNT(*)::int AS total_tasks,
        COUNT(*) FILTER (WHERE t.status = 'done')::int AS completed_tasks
    FROM tasks t
    WHERE t.deleted_at IS NULL AND t.milestone_id IS NOT NULL
    GROUP BY t.milestone_id
),
incomplete_deps AS (
    SELECT
        md.successor_id AS milestone_id,
        COUNT(*)::int AS incomplete_dep_count,
        COALESCE(array_agg(pm.id::text), ARRAY[]::text[]) AS incomplete_predecessor_ids,
        COALESCE(array_agg(pm.title), ARRAY[]::text[]) AS incomplete_predecessor_titles
    FROM milestone_dependencies md
    JOIN milestones pm ON md.predecessor_id = pm.id
    WHERE pm.deleted_at IS NULL
      AND pm.completed_at IS NULL
      AND COALESCE(pm.status_override, '') != 'done'
    GROUP BY md.successor_id
)
SELECT
    m.id,
    m.user_id,
    m.stage_id,
    m.objective_id,
    m.title,
    m.definition_of_done,
    m.due_date,
    m.completed_at,
    m.est_hours,
    m.ordinal,
    m.status_override,
    m.created_at,
    m.updated_at,
    m.deleted_at,
    m.hlc,
    m.version,
    COALESCE(ts.total_tasks, 0) AS total_tasks,
    COALESCE(ts.completed_tasks, 0) AS completed_tasks,
    COALESCE(id.incomplete_dep_count, 0) AS blocked_by_count,
    COALESCE(id.incomplete_predecessor_ids, ARRAY[]::text[]) AS incomplete_predecessor_ids,
    COALESCE(id.incomplete_predecessor_titles, ARRAY[]::text[]) AS incomplete_predecessor_titles,
    CASE
        -- 1. Completed
        WHEN m.completed_at IS NOT NULL OR m.status_override = 'done' THEN 'done'
        
        -- 2. Blocked: if any incomplete dependency exists in milestone_dependencies
        WHEN COALESCE(id.incomplete_dep_count, 0) > 0 THEN 'blocked'
        
        -- 3. Slipped: if due_date has passed (< NOW()) and status is not done
        WHEN m.due_date IS NOT NULL AND m.due_date < CURRENT_TIMESTAMP THEN 'slipped'
        
        -- 4. At Risk: if due_date is within 7 days and linked task completion is under 50%
        WHEN m.due_date IS NOT NULL
             AND m.due_date <= CURRENT_TIMESTAMP + INTERVAL '7 days'
             AND (COALESCE(ts.total_tasks, 0) > 0 AND (COALESCE(ts.completed_tasks, 0)::float / ts.total_tasks::float) < 0.5)
        THEN 'at_risk'
        
        -- 5. Explicit status override (e.g. in_progress, paused)
        WHEN m.status_override IS NOT NULL AND m.status_override != 'pending' THEN m.status_override
        
        -- 6. In progress (if tasks started)
        WHEN COALESCE(ts.completed_tasks, 0) > 0 THEN 'in_progress'
        
        -- 7. Default pending
        ELSE 'pending'
    END AS derived_status
FROM milestones m
LEFT JOIN task_stats ts ON m.id = ts.milestone_id
LEFT JOIN incomplete_deps id ON m.id = id.milestone_id
WHERE m.deleted_at IS NULL;
