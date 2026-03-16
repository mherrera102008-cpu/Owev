// @ts-nocheck
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every day at midnight UTC — sweeps all invoices and transitions statuses
crons.daily(
  "update invoice statuses",
  { hourUTC: 0, minuteUTC: 0 },
  internal.invoices.updateStatuses
);

export default crons;
