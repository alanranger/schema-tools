import { deployCommitMessage } from "./lib/deploy-commit-message.mjs";

const eventMsg = deployCommitMessage(
  ["batsford-arboretum-autumn-photography-31oct_event_schema.json"],
  ["old-workshop_event_schema.json", "other-old_event_schema.json"],
  { cleanupEventSchemas: true }
);
const productMsg = deployCommitMessage(
  ["beginners-photography-course-3-weekly-evening-classes_schema.json", "beginners-photography-course-3-weekly-evening-classes_faq.json"],
  [],
  { cleanupProductSchemas: true }
);
console.log("event dry-run:", eventMsg);
console.log("product dry-run:", productMsg);
if (eventMsg !== "Sync 1 event schema files (remove 2 event)") {
  throw new Error("unexpected event message: " + eventMsg);
}
if (productMsg !== "Update 2 product schema files") {
  throw new Error("unexpected product message: " + productMsg);
}
console.log("ok");
