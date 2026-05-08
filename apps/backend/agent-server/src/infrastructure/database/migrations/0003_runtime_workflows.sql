CREATE TABLE IF NOT EXISTS workflow_runs (
  id varchar(64) PRIMARY KEY,
  "workflowId" varchar(128) NOT NULL,
  status varchar(32) NOT NULL,
  "startedAt" bigint NOT NULL,
  "completedAt" bigint,
  "inputData" jsonb,
  "traceData" jsonb
);
