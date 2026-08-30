-- Attach sync_node_trigger to notes table
DROP TRIGGER IF EXISTS sync_note_node ON "notes";

CREATE TRIGGER sync_note_node
AFTER INSERT OR UPDATE OR DELETE ON "notes"
FOR EACH ROW
EXECUTE FUNCTION sync_node_trigger();
