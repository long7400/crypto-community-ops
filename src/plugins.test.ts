import fs from "node:fs";
import path from "node:path";
import type { TestCase } from "@elizaos/core";
import {
  AgentRuntime,
  type Character,
  type IAgentRuntime,
  logger,
  type Plugin,
  stringToUuid,
  type TestSuite,
} from "@elizaos/core";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, it } from "vitest";
import project from "./index";

dotenv.config({ path: "../../.env" });

const TEST_TIMEOUT = 300000;

function ensureTestCharacter(
  character: Character | Partial<Character>,
  overrides: Partial<Character> = {},
): Character {
  return {
    ...character,
    ...overrides,
    name: overrides.name ?? character.name ?? "TestCharacter",
    bio: overrides.bio ?? character.bio ?? "Test character bio",
    plugins: overrides.plugins ?? character.plugins ?? [],
  };
}

const defaultCharacter = ensureTestCharacter(project.agents[0].character);

const elizaOpenAIFirst = ensureTestCharacter(project.agents[0].character, {
  name: "ElizaOpenAIFirst",
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-openai", // OpenAI first, embedding size = 1536
    "@elizaos/plugin-elevenlabs",
    "@elizaos/plugin-pdf",
    "@elizaos/plugin-video-understanding",
    "@elizaos/plugin-storage-s3",
  ],
});

const agentRuntimes = new Map<string, IAgentRuntime>();
const runtimeTempDirs = new Map<string, string>();
const testDbRootDir = path.join(process.cwd(), ".tmp", "test-db");

function clearPreviousTempDbs(): void {
  fs.rmSync(testDbRootDir, { recursive: true, force: true });
  fs.mkdirSync(testDbRootDir, { recursive: true });
}

function createTempDbDir(characterName: string): string {
  const safeCharacterName = characterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const dataDir = path.join(testDbRootDir, safeCharacterName || "agent");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  console.log(`Using isolated test database directory: ${dataDir}`);

  return dataDir;
}

function getPluginMigrationTarget(plugin: Plugin | undefined): {
  name: string;
  schema: Record<string, unknown>;
} {
  const schema = plugin?.schema;

  if (!plugin || !schema) {
    throw new Error(
      "@elizaos/plugin-sql default export does not expose schema; cannot run test migrations",
    );
  }

  return {
    name: plugin.name,
    schema,
  };
}

// Initialize runtime for a character
/**
 * Asynchronously initializes the runtime for a given character with the provided configuration.
 *
 * @param {Character} character - The character for which the runtime is being initialized.
 * @returns {Promise<IAgentRuntime>} A promise that resolves to the initialized agent runtime.
 */
async function initializeRuntime(character: Character): Promise<IAgentRuntime> {
  let dataDir: string | undefined;

  try {
    character.id = stringToUuid(character.name);

    dataDir = createTempDbDir(character.name);
    runtimeTempDirs.set(character.name, dataDir);

    const characterSettings = {
      ...(character.settings ?? {}),
      PGLITE_DATA_DIR: dataDir,
      POSTGRES_URL: "",
      DATABASE_URL: "",
    };

    character.settings = characterSettings;

    const runtime = new AgentRuntime({
      character: {
        ...character,
        settings: characterSettings,
      },
      settings: {
        PGLITE_DATA_DIR: dataDir,
        POSTGRES_URL: "",
        DATABASE_URL: "",
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestTarget =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        logger.debug(`Test fetch: ${requestTarget}`);
        return fetch(input, init);
      },
    });

    const drizzleAdapter = await import("@elizaos/plugin-sql");
    const adapter = drizzleAdapter.createDatabaseAdapter(
      { dataDir },
      runtime.agentId,
    );

    if (!adapter) {
      throw new Error("No database adapter found in default drizzle plugin");
    }

    runtime.registerDatabaseAdapter(adapter);

    if (typeof adapter.runPluginMigrations !== "function") {
      throw new Error(
        "Database adapter does not support plugin migrations; cannot initialize test database",
      );
    }

    const migrationTarget = getPluginMigrationTarget(drizzleAdapter.default);

    await adapter.runPluginMigrations([migrationTarget], {
      verbose: true,
      force: false,
      dryRun: false,
    });

    await runtime.initialize();

    logger.info(`Test runtime initialized for ${character.name}`);

    // Log expected embedding dimension based on plugins
    const hasOpenAIFirst = character.plugins?.[0] === "@elizaos/plugin-openai";
    const expectedDimension = hasOpenAIFirst ? 1536 : 384;
    logger.info(
      `Expected embedding dimension for ${character.name}: ${expectedDimension}`,
    );
    return runtime;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Failed to initialize test runtime for ${character.name}: ${message}`,
    );
    throw error;
  }
}

// Initialize the runtimes
beforeAll(async () => {
  clearPreviousTempDbs();

  const characters = [defaultCharacter, elizaOpenAIFirst];

  for (const character of characters) {
    const config = await initializeRuntime(character);
    agentRuntimes.set(character.name, config);
  }
}, TEST_TIMEOUT);

// Cleanup after all tests
afterAll(async () => {
  for (const [characterName, dataDir] of runtimeTempDirs.entries()) {
    try {
      const runtime = agentRuntimes.get(characterName) as
        | { stop?: () => Promise<void>; close?: () => Promise<void> }
        | undefined;

      if (runtime?.stop) {
        await runtime.stop();
      } else if (runtime?.close) {
        await runtime.close();
      }

      logger.info(`Preserved ${characterName} test database at ${dataDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error during cleanup for ${characterName}: ${message}`);
    }
  }

  agentRuntimes.clear();
  runtimeTempDirs.clear();
});

// Test suite for each character
describe("Multi-Character Plugin Tests", () => {
  it(
    "should run tests for Default Character",
    async () => {
      const runtime = agentRuntimes.get(defaultCharacter.name);
      if (!runtime) throw new Error("Runtime not found for Default Character");

      const testRunner = new TestRunner(runtime);
      await testRunner.runPluginTests();
    },
    TEST_TIMEOUT,
  );

  it(
    "should run tests for ElizaOpenAIFirst (1536 dimension)",
    async () => {
      const runtime = agentRuntimes.get("ElizaOpenAIFirst");
      if (!runtime) throw new Error("Runtime not found for ElizaOpenAIFirst");

      const testRunner = new TestRunner(runtime);
      await testRunner.runPluginTests();
    },
    TEST_TIMEOUT,
  );
});

/**
 * Interface representing test statistics.
 * @interface
 * @property {number} total - Total number of tests.
 * @property {number} passed - Number of tests that passed.
 * @property {number} failed - Number of tests that failed.
 * @property {number} skipped - Number of tests that were skipped.
 */
interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * Represents the result of a test.
 * @typedef {Object} TestResult
 * @property {string} file - The file where the test was executed.
 * @property {string} suite - The test suite name.
 * @property {string} name - The name of the test.
 * @property {"passed" | "failed"} status - The status of the test, can be either "passed" or "failed".
 * @property {Error} [error] - Optional error object if the test failed.
 */
interface TestResult {
  file: string;
  suite: string;
  name: string;
  status: "passed" | "failed";
  error?: Error;
}

/**
 * Enumeration representing the status of a test.
 * @enum {string}
 * @readonly
 * @property {string} Passed - Indicates that the test has passed.
 * @property {string} Failed - Indicates that the test has failed.
 */
enum TestStatus {
  Passed = "passed",
  Failed = "failed",
}

/**
 * TestRunner class for running plugin tests and handling test results.
 * * @class TestRunner
 */
class TestRunner {
  private runtime: IAgentRuntime;
  private stats: TestStats;
  private testResults: Map<string, TestResult[]> = new Map();

  /**
   * Constructor function for creating a new instance of the class.
   *
   * @param {IAgentRuntime} runtime - The runtime environment for the agent.
   */
  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  /**
   * Asynchronously runs a test case and updates the test results accordingly.
   *
   * @param {TestCase} test - The test case to run.
   * @param {string} file - The file the test case belongs to.
   * @param {string} suite - The suite the test case belongs to.
   * @returns {Promise<void>} - A Promise that resolves once the test case has been run.
   */
  private async runTestCase(
    test: TestCase,
    file: string,
    suite: string,
  ): Promise<void> {
    const startTime = performance.now();
    try {
      await test.fn(this.runtime);
      this.stats.passed++;
      const duration = performance.now() - startTime;
      logger.info(`✓ ${test.name} (${Math.round(duration)}ms)`);
      this.addTestResult(file, suite, test.name, TestStatus.Passed);
    } catch (error) {
      this.stats.failed++;
      logger.error(`✗ ${test.name}`);
      logger.error(error instanceof Error ? error : String(error));
      const testError =
        error instanceof Error ? error : new Error(String(error));
      this.addTestResult(file, suite, test.name, TestStatus.Failed, testError);
    }
  }

  /**
   * Add a test result to the testResults map.
   * @param {string} file - The file being tested.
   * @param {string} suite - The test suite name.
   * @param {string} name - The test name.
   * @param {TestStatus} status - The status of the test (passed, failed, skipped, etc.).
   * @param {Error} [error] - The error object if the test failed.
   */
  private addTestResult(
    file: string,
    suite: string,
    name: string,
    status: TestStatus,
    error?: Error,
  ) {
    if (!this.testResults.has(file)) {
      this.testResults.set(file, []);
    }
    this.testResults.get(file)?.push({ file, suite, name, status, error });
  }

  /**
   * Runs a test suite, logging the name of the suite and running each test case.
   *
   * @param {TestSuite} suite - The test suite to run.
   * @param {string} file - The file containing the test suite.
   * @returns {Promise<void>}
   */
  private async runTestSuite(suite: TestSuite, file: string): Promise<void> {
    logger.info(`\nTest suite: ${suite.name}`);
    for (const test of suite.tests) {
      this.stats.total++;
      await this.runTestCase(test, file, suite.name);
    }
  }

  /**
   * Runs tests for all plugins in the runtime and returns the test statistics.
   * @returns {Promise<TestStats>} The test statistics object.
   */
  public async runPluginTests(): Promise<TestStats> {
    console.log("*** Running plugin tests...");
    const plugins = this.runtime.plugins;

    for (const plugin of plugins) {
      try {
        logger.info(`Running tests for plugin: ${plugin.name}`);
        const pluginTests = plugin.tests;
        // Handle both single suite and array of suites
        const testSuites = Array.isArray(pluginTests)
          ? pluginTests
          : [pluginTests];

        for (const suite of testSuites) {
          if (suite) {
            const fileName = `${plugin.name} test suite`;
            await this.runTestSuite(suite, fileName);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error in plugin ${plugin.name}: ${message}`);
        throw error;
      }
    }

    this.logTestSummary();
    if (this.stats.failed > 0) {
      throw new Error("An error occurred during plugin tests.");
    }
    return this.stats;
  }

  /**
   * Logs the summary of test results in the console with colors for each section.
   */
  private logTestSummary(): void {
    const COLORS = {
      reset: "\x1b[0m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      gray: "\x1b[90m",
      bold: "\x1b[1m",
      underline: "\x1b[4m",
    };

    const colorize = (
      text: string,
      color: keyof typeof COLORS,
      bold = false,
    ): string => {
      return `${bold ? COLORS.bold : ""}${COLORS[color]}${text}${COLORS.reset}`;
    };

    const printSectionHeader = (title: string, color: keyof typeof COLORS) => {
      console.log(
        colorize(
          `\n${"⎯".repeat(25)}  ${title} ${"⎯".repeat(25)}\n`,
          color,
          true,
        ),
      );
    };

    const printTestSuiteSummary = () => {
      printSectionHeader("Test Suites", "cyan");

      let failedTestSuites = 0;
      this.testResults.forEach((tests, file) => {
        const failed = tests.filter((t) => t.status === "failed").length;
        const total = tests.length;

        if (failed > 0) {
          failedTestSuites++;
          console.log(` ${colorize("❯", "yellow")} ${file} (${total})`);
        } else {
          console.log(` ${colorize("✓", "green")} ${file} (${total})`);
        }

        const groupedBySuite = new Map<string, TestResult[]>();
        tests.forEach((t) => {
          if (!groupedBySuite.has(t.suite)) {
            groupedBySuite.set(t.suite, []);
          }
          groupedBySuite.get(t.suite)?.push(t);
        });

        groupedBySuite.forEach((suiteTests, suite) => {
          const failed = suiteTests.filter((t) => t.status === "failed").length;
          if (failed > 0) {
            console.log(
              `   ${colorize("❯", "yellow")} ${suite} (${suiteTests.length})`,
            );
            suiteTests.forEach((test) => {
              const symbol =
                test.status === "passed"
                  ? colorize("✓", "green")
                  : colorize("×", "red");
              console.log(`     ${symbol} ${test.name}`);
            });
          } else {
            console.log(
              `   ${colorize("✓", "green")} ${suite} (${suiteTests.length})`,
            );
          }
        });
      });

      return failedTestSuites;
    };

    const printFailedTests = () => {
      printSectionHeader("Failed Tests", "red");

      this.testResults.forEach((tests) => {
        tests.forEach((test) => {
          if (test.status === "failed") {
            console.log(
              ` ${colorize("FAIL", "red")} ${test.file} > ${test.suite} > ${test.name}`,
            );
            console.log(
              ` ${colorize(`AssertionError: ${test.error?.message}`, "red")}`,
            );
            console.log(`\n${colorize("⎯".repeat(66), "red")}\n`);
          }
        });
      });
    };

    const printTestSummary = (failedTestSuites: number) => {
      printSectionHeader("Test Summary", "cyan");

      console.log(
        ` ${colorize("Test Suites:", "gray")} ${
          failedTestSuites > 0
            ? colorize(`${failedTestSuites} failed | `, "red")
            : ""
        }${colorize(
          `${this.testResults.size - failedTestSuites} passed`,
          "green",
        )} (${this.testResults.size})`,
      );
      console.log(
        ` ${colorize("      Tests:", "gray")} ${
          this.stats.failed > 0
            ? colorize(`${this.stats.failed} failed | `, "red")
            : ""
        }${colorize(`${this.stats.passed} passed`, "green")} (${this.stats.total})`,
      );
    };

    const failedTestSuites = printTestSuiteSummary();
    if (this.stats.failed > 0) {
      printFailedTests();
    }
    printTestSummary(failedTestSuites);
  }
}
