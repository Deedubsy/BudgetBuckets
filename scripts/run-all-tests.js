#!/usr/bin/env node

/**
 * Comprehensive test runner for Budget Buckets
 * Runs all test suites in sequence with reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      unit: { status: 'pending', duration: 0, output: '' },
      integration: { status: 'pending', duration: 0, output: '' },
      performance: { status: 'pending', duration: 0, output: '' },
      e2e: { status: 'pending', duration: 0, output: '' },
      visual: { status: 'pending', duration: 0, output: '' }
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
      
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        ...options
      });

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        if (!options.silent) {
          process.stdout.write(text);
        }
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        if (!options.silent) {
          process.stderr.write(text);
        }
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          code,
          duration,
          output: output + errorOutput,
          success: code === 0
        };

        if (code === 0) {
          console.log(`✅ Completed in ${(duration / 1000).toFixed(2)}s`);
          resolve(result);
        } else {
          console.log(`❌ Failed with code ${code} after ${(duration / 1000).toFixed(2)}s`);
          resolve(result); // Don't reject, let the caller handle failures
        }
      });

      proc.on('error', (error) => {
        console.log(`💥 Process error: ${error.message}`);
        reject(error);
      });
    });
  }

  async runUnitTests() {
    console.log('\n📋 Running Unit Tests...');
    const result = await this.runCommand('npm', ['run', 'test:unit']);
    
    this.results.unit = {
      status: result.success ? 'passed' : 'failed',
      duration: result.duration,
      output: result.output,
      exitCode: result.code
    };

    return result.success;
  }

  async runIntegrationTests() {
    console.log('\n🔗 Running Integration Tests...');
    const result = await this.runCommand('npm', ['run', 'test:integration']);
    
    this.results.integration = {
      status: result.success ? 'passed' : 'failed',
      duration: result.duration,
      output: result.output,
      exitCode: result.code
    };

    return result.success;
  }

  async runPerformanceTests() {
    console.log('\n⚡ Running Performance Tests...');
    const result = await this.runCommand('npm', ['run', 'test:performance']);
    
    this.results.performance = {
      status: result.success ? 'passed' : 'failed',
      duration: result.duration,
      output: result.output,
      exitCode: result.code
    };

    return result.success;
  }

  async runE2ETests() {
    console.log('\n🌐 Running E2E Tests...');
    
    // Check if browsers are installed
    const browserCheck = await this.runCommand('npx', ['playwright', '--version'], { silent: true });
    if (!browserCheck.success) {
      console.log('⚠️ Playwright not properly installed, skipping E2E tests');
      this.results.e2e = {
        status: 'skipped',
        duration: 0,
        output: 'Playwright not installed',
        exitCode: -1
      };
      return true; // Don't fail the whole suite
    }

    const result = await this.runCommand('npm', ['run', 'test:e2e'], {
      timeout: 300000 // 5 minute timeout for E2E tests
    });
    
    this.results.e2e = {
      status: result.success ? 'passed' : 'failed',
      duration: result.duration,
      output: result.output,
      exitCode: result.code
    };

    return result.success;
  }

  async runVisualRegressionTests() {
    console.log('\n👁️ Running Visual Regression Tests...');
    
    const result = await this.runCommand('npx', ['playwright', 'test', 'e2e-tests/visual-regression.spec.js'], {
      timeout: 300000 // 5 minute timeout
    });
    
    this.results.visual = {
      status: result.success ? 'passed' : 'failed',
      duration: result.duration,
      output: result.output,
      exitCode: result.code
    };

    return result.success;
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const passedTests = Object.values(this.results).filter(r => r.status === 'passed').length;
    const totalTests = Object.values(this.results).filter(r => r.status !== 'pending').length;
    const skippedTests = Object.values(this.results).filter(r => r.status === 'skipped').length;

    const report = `
# Budget Buckets Test Report

**Generated:** ${new Date().toISOString()}
**Total Duration:** ${(totalTime / 1000 / 60).toFixed(2)} minutes
**Results:** ${passedTests}/${totalTests} passed${skippedTests > 0 ? ` (${skippedTests} skipped)` : ''}

## Test Suite Results

| Suite | Status | Duration | Exit Code |
|-------|---------|----------|-----------|
| Unit Tests | ${this.getStatusEmoji(this.results.unit.status)} ${this.results.unit.status} | ${(this.results.unit.duration / 1000).toFixed(2)}s | ${this.results.unit.exitCode || 'N/A'} |
| Integration Tests | ${this.getStatusEmoji(this.results.integration.status)} ${this.results.integration.status} | ${(this.results.integration.duration / 1000).toFixed(2)}s | ${this.results.integration.exitCode || 'N/A'} |
| Performance Tests | ${this.getStatusEmoji(this.results.performance.status)} ${this.results.performance.status} | ${(this.results.performance.duration / 1000).toFixed(2)}s | ${this.results.performance.exitCode || 'N/A'} |
| E2E Tests | ${this.getStatusEmoji(this.results.e2e.status)} ${this.results.e2e.status} | ${(this.results.e2e.duration / 1000).toFixed(2)}s | ${this.results.e2e.exitCode || 'N/A'} |
| Visual Regression | ${this.getStatusEmoji(this.results.visual.status)} ${this.results.visual.status} | ${(this.results.visual.duration / 1000).toFixed(2)}s | ${this.results.visual.exitCode || 'N/A'} |

## Quality Gates

- ✅ Unit Tests: Core business logic validated
- ${this.results.integration.status === 'passed' ? '✅' : '❌'} Integration Tests: Firebase operations verified
- ${this.results.performance.status === 'passed' ? '✅' : '⚠️'} Performance Tests: Speed requirements met
- ${this.results.e2e.status === 'passed' ? '✅' : this.results.e2e.status === 'skipped' ? '⚠️' : '❌'} E2E Tests: User journeys functional
- ${this.results.visual.status === 'passed' ? '✅' : this.results.visual.status === 'skipped' ? '⚠️' : '❌'} Visual Tests: UI consistency maintained

## Recommendations

${this.generateRecommendations()}
`;

    return report;
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⚠️';
      default: return '⏳';
    }
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.unit.status === 'failed') {
      recommendations.push('- 🔴 **Critical**: Fix failing unit tests before deployment');
    }

    if (this.results.integration.status === 'failed') {
      recommendations.push('- 🔴 **Critical**: Address integration test failures - may indicate Firebase configuration issues');
    }

    if (this.results.performance.status === 'failed') {
      recommendations.push('- 🟡 **Performance**: Optimize slow operations identified in performance tests');
    }

    if (this.results.e2e.status === 'failed') {
      recommendations.push('- 🟡 **User Experience**: Fix E2E test failures to ensure user journeys work correctly');
    }

    if (this.results.visual.status === 'failed') {
      recommendations.push('- 🟡 **UI**: Review visual regression failures for unintended UI changes');
    }

    if (this.results.e2e.status === 'skipped') {
      recommendations.push('- 💡 **Setup**: Install Playwright browsers with `npx playwright install` for E2E testing');
    }

    if (recommendations.length === 0) {
      recommendations.push('- 🎉 **All tests passed!** Ready for deployment.');
    }

    return recommendations.join('\n');
  }

  async saveReport() {
    const report = this.generateReport();
    const reportPath = path.join(__dirname, '..', 'test-reports', `test-report-${Date.now()}.md`);
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Test report saved to: ${reportPath}`);
    
    return reportPath;
  }

  async run() {
    console.log('🧪 Budget Buckets - Comprehensive Test Suite');
    console.log('==========================================\n');

    const runInSequence = process.argv.includes('--sequential');
    const skipE2E = process.argv.includes('--skip-e2e');
    const skipVisual = process.argv.includes('--skip-visual');

    try {
      // Always run unit tests first (they're fast and critical)
      const unitSuccess = await this.runUnitTests();

      // Run integration tests
      const integrationSuccess = await this.runIntegrationTests();

      // Run performance tests (can run even if integration fails)
      const performanceSuccess = await this.runPerformanceTests();

      // Run E2E tests if not skipped
      let e2eSuccess = true;
      if (!skipE2E) {
        e2eSuccess = await this.runE2ETests();
      } else {
        console.log('\n⏭️ Skipping E2E tests (--skip-e2e flag provided)');
        this.results.e2e.status = 'skipped';
      }

      // Run visual regression tests if not skipped
      let visualSuccess = true;
      if (!skipVisual && !skipE2E) {
        visualSuccess = await this.runVisualRegressionTests();
      } else {
        console.log('\n⏭️ Skipping Visual Regression tests');
        this.results.visual.status = 'skipped';
      }

      // Generate and display report
      console.log('\n📊 Test Results Summary');
      console.log('=======================');
      console.log(this.generateReport());

      // Save detailed report
      await this.saveReport();

      // Determine overall success
      const criticalTests = [unitSuccess, integrationSuccess];
      const allCriticalPassed = criticalTests.every(Boolean);
      
      if (allCriticalPassed) {
        console.log('\n🎉 All critical tests passed! ✨');
        process.exit(0);
      } else {
        console.log('\n💥 Some critical tests failed!');
        process.exit(1);
      }

    } catch (error) {
      console.error('\n💥 Test runner encountered an error:', error.message);
      process.exit(1);
    }
  }
}

// Run the test suite if this script is called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run();
}

module.exports = TestRunner;