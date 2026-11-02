// Constraints and indexes for the Evidence Graph (REQUIREMENTS.md 4.4.8).
// Idempotent: safe to run repeatedly. One statement per line block, separated by ';'.

CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT nameusage_id IF NOT EXISTS FOR (n:NameUsage) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT source_id IF NOT EXISTS FOR (n:Source) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT evidence_id IF NOT EXISTS FOR (n:Evidence) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT claim_id IF NOT EXISTS FOR (n:Claim) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT time_id IF NOT EXISTS FOR (n:Time) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT existenceevent_id IF NOT EXISTS FOR (n:ExistenceEvent) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT conflict_id IF NOT EXISTS FOR (n:Conflict) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT capture_id IF NOT EXISTS FOR (n:Capture) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT thread_id IF NOT EXISTS FOR (n:Thread) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT narrativesentence_id IF NOT EXISTS FOR (n:NarrativeSentence) REQUIRE n.id IS UNIQUE;

CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type);
CREATE INDEX time_level IF NOT EXISTS FOR (n:Time) ON (n.level, n.value);
