-- Function to synchronize polymorphic entities (tasks, etc.) to the central nodes index table
CREATE OR REPLACE FUNCTION sync_node_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
        VALUES (NEW.id, NEW.user_id, TG_TABLE_NAME, NEW.title)
        ON CONFLICT ("id") DO UPDATE
        SET "title" = EXCLUDED.title,
            "user_id" = EXCLUDED.user_id,
            "entity_type" = EXCLUDED.entity_type;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE "nodes"
        SET "title" = NEW.title
        WHERE "id" = NEW.id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM "nodes"
        WHERE "id" = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tasks table
DROP TRIGGER IF EXISTS sync_task_node ON "tasks";

CREATE TRIGGER sync_task_node
AFTER INSERT OR UPDATE OR DELETE ON "tasks"
FOR EACH ROW
EXECUTE FUNCTION sync_node_trigger();

-- Backfill any existing tasks into nodes table
INSERT INTO "nodes" ("id", "user_id", "entity_type", "title")
SELECT id, user_id, 'tasks', title FROM "tasks"
ON CONFLICT ("id") DO UPDATE
SET "title" = EXCLUDED.title;
