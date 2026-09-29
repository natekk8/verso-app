/**
 * Verso Universal E2E Test Runner
 * 
 * Executes requirement-driven test suites across Tiers 1-4.
 * Can be run standalone with Node 24 (`node --experimental-strip-types tests/e2e_runner.ts`)
 * or with tsx / vitest.
 * 
 * Flags:
 *   --tier <1|2|3|4> : Run only specified tier
 *   --verbose        : Print all individual test names and execution times
 *   --summary        : Display requirement coverage summary table
 */

import { TestRegistry, type TestSuite, type TestCase, type TestResult } from "./harness.ts";

// Import all test suites
import "./tier1_feature.test.ts";
import "./tier2_boundary.test.ts";
import "./tier3_pairwise.test.ts";
import "./tier4_workloads.test.ts";

interface CliOptions {
  tierFilter?: number;
  verbose: boolean;
  summary: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    verbose: false,
    summary: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tier" && i + 1 < args.length) {
      options.tierFilter = parseInt(args[++i], 10);
    } else if (arg.startsWith("--tier=")) {
      options.tierFilter = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--no-summary") {
      options.summary = false;
    }
  }

  return options;
}

const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Feature Coverage (R1-R7)",
  2: "Boundary & Corner Cases",
  3: "Cross-Feature Combinations (Pairwise)",
  4: "Real-World Workloads ('Mistrzostwa 1v1 FSS' Lifecycle)",
};

async function runTestRunner() {
  const options = parseCliArgs();
  const registry = TestRegistry.getInstance();
  const suites = registry.getSuites(options.tierFilter);

  console.log("\n================================================================================");
  console.log("                      VERSO OPAQUE-BOX E2E TEST RUNNER                          ");
  console.log("================================================================================");
  console.log(`Execution Mode: Native Node Strip-Types / Universal Harness`);
  if (options.tierFilter) {
    console.log(`Filter: Tier ${options.tierFilter} (${TIER_DESCRIPTIONS[options.tierFilter] ?? "Custom"})`);
  } else {
    console.log(`Filter: All Tiers (1 - 4)`);
  }
  console.log("--------------------------------------------------------------------------------\n");

  const results: TestResult[] = [];
  const startTime = Date.now();

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n▶ [Tier ${suite.tier}] ${suite.name}`);

    for (const testCase of suite.cases) {
      const caseStart = Date.now();
      let passed = true;
      let testError: Error | undefined = undefined;

      try {
        const res = testCase.fn();
        if (res && typeof (res as any).then === "function") {
          await res;
        }
      } catch (err: any) {
        passed = false;
        testError = err;
      }

      const caseDuration = Date.now() - caseStart;

      results.push({
        suiteName: suite.name,
        testName: testCase.name,
        tier: suite.tier,
        passed,
        durationMs: caseDuration,
        error: testError,
        reqTag: testCase.reqTag,
      });

      if (passed) {
        totalPassed++;
        if (options.verbose) {
          console.log(`   ✓ ${testCase.name} (${caseDuration}ms)`);
        }
      } else {
        totalFailed++;
        console.log(`   ✗ ${testCase.name} (${caseDuration}ms)`);
        if (testError) {
          console.log(`     Error: ${testError.message}`);
          if (testError.stack && options.verbose) {
            console.log(`     ${testError.stack}`);
          }
        }
      }
    }

    const suiteResults = results.filter((r) => r.suiteName === suite.name);
    const suitePassed = suiteResults.every((r) => r.passed);
    const mark = suitePassed ? "✓ PASS" : "✗ FAIL";
    console.log(`   ${mark} (${suite.cases.length} tests)`);
  }

  const totalTime = Date.now() - startTime;

  console.log("\n================================================================================");
  console.log("                            TEST EXECUTION SUMMARY                              ");
  console.log("================================================================================");

  // Group by Tier
  const tierMap = new Map<number, { passed: number; failed: number; total: number }>();
  for (const r of results) {
    if (!tierMap.has(r.tier)) {
      tierMap.set(r.tier, { passed: 0, failed: 0, total: 0 });
    }
    const stat = tierMap.get(r.tier)!;
    stat.total++;
    if (r.passed) stat.passed++;
    else stat.failed++;
  }

  console.log(`| Tier   | Description                                          | Tests | Pass | Fail |`);
  console.log(`|--------|------------------------------------------------------|-------|------|------|`);

  for (const [tier, stat] of Array.from(tierMap.entries()).sort((a, b) => a[0] - b[0])) {
    const desc = (TIER_DESCRIPTIONS[tier] ?? "Tier " + tier).padEnd(52, " ");
    const tStr = String(stat.total).padStart(5, " ");
    const pStr = String(stat.passed).padStart(4, " ");
    const fStr = String(stat.failed).padStart(4, " ");
    console.log(`| Tier ${tier} | ${desc} | ${tStr} | ${pStr} | ${fStr} |`);
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Total Suites:     ${suites.length}`);
  console.log(`Total Tests:      ${results.length}`);
  console.log(`Tests Passed:     ${totalPassed}`);
  console.log(`Tests Failed:     ${totalFailed}`);
  console.log(`Total Assertions: ${registry.totalAssertions}`);
  console.log(`Total Time:       ${totalTime}ms`);
  console.log(`Status:           ${totalFailed === 0 ? "PASSED (100%)" : "FAILED"}`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Direct execution entry point
runTestRunner().catch((err) => {
  console.error("Fatal runner exception:", err);
  process.exit(1);
});
