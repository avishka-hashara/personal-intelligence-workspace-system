-- Attach sync_node_trigger to goals table
DROP TRIGGER IF EXISTS sync_goal_node ON "goals";

CREATE TRIGGER sync_goal_node
AFTER INSERT OR UPDATE OR DELETE ON "goals"
FOR EACH ROW
EXECUTE FUNCTION sync_node_trigger();

-- Attach sync_node_trigger to courses table
DROP TRIGGER IF EXISTS sync_course_node ON "courses";

CREATE TRIGGER sync_course_node
AFTER INSERT OR UPDATE OR DELETE ON "courses"
FOR EACH ROW
EXECUTE FUNCTION sync_node_trigger();

-- Backfill all existing active entities into nodes
INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
SELECT id, user_id, 'tasks', title FROM "tasks"
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED.title, "entity_type" = EXCLUDED.entity_type;

INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
SELECT id, user_id, 'notes', title FROM "notes"
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED.title, "entity_type" = EXCLUDED.entity_type;

INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
SELECT id, user_id, 'goals', title FROM "goals"
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED.title, "entity_type" = EXCLUDED.entity_type;

INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
SELECT id, user_id, 'courses', title FROM "courses"
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED.title, "entity_type" = EXCLUDED.entity_type;
