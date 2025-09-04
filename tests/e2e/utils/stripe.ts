/**
 * Stripe CLI integration utilities for E2E tests
 */
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

interface StripeListenProcess {
  process: ChildProcess;
  ready: boolean;
  forwardUrl: string;
}

let stripeListenProcess: StripeListenProcess | null = null;

/**
 * Check if E2E Stripe testing is enabled
 */
export function isStripeE2EEnabled(): boolean {
  return process.env.E2E_STRIPE === '1';
}

/**
 * Check if Stripe CLI is available
 */
export async function isStripeCLIAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('stripe', ['--version'], { stdio: 'pipe' });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    
    proc.on('error', () => {
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Start Stripe listen process in background
 */
export async function stripeListenStart(forwardUrl: string): Promise<void> {
  if (!isStripeE2EEnabled()) {
    console.log('⚠️ E2E_STRIPE not enabled, skipping Stripe listen');
    return;
  }
  
  if (!(await isStripeCLIAvailable())) {
    throw new Error('Stripe CLI not available. Install with: brew install stripe/stripe-cli/stripe');
  }
  
  if (stripeListenProcess?.ready) {
    console.log('✓ Stripe listen already running');
    return;
  }
  
  console.log(`🎧 Starting Stripe listen forwarding to ${forwardUrl}`);
  
  const proc = spawn('stripe', [
    'listen',
    '--forward-to', forwardUrl,
    '--print-json'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  stripeListenProcess = {
    process: proc,
    ready: false,
    forwardUrl
  };
  
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('Stripe listen startup timeout'));
    }, 30000);
    
    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Look for ready indicator
      if (text.includes('Ready!') || text.includes('webhook endpoint') || text.includes('listening')) {
        if (stripeListenProcess) {
          stripeListenProcess.ready = true;
        }
        clearTimeout(timeout);
        console.log('✅ Stripe listen ready');
        resolve();
      }
    });
    
    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      console.error('Stripe listen error:', text);
      
      if (text.includes('authentication')) {
        clearTimeout(timeout);
        reject(new Error('Stripe CLI authentication required. Run: stripe login'));
      }
    });
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      stripeListenProcess = null;
      
      if (code !== 0) {
        reject(new Error(`Stripe listen exited with code ${code}`));
      }
    });
    
    proc.on('error', (error) => {
      clearTimeout(timeout);
      stripeListenProcess = null;
      reject(error);
    });
  });
}

/**
 * Trigger a Stripe webhook event
 */
export async function stripeTrigger(
  eventName: string, 
  overrides: Record<string, any> = {}
): Promise<void> {
  if (!isStripeE2EEnabled()) {
    console.log(`⚠️ E2E_STRIPE not enabled, skipping trigger: ${eventName}`);
    return;
  }
  
  if (!(await isStripeCLIAvailable())) {
    throw new Error('Stripe CLI not available');
  }
  
  console.log(`⚡ Triggering Stripe event: ${eventName}`);
  
  const args = ['trigger', eventName];
  
  // Add overrides as command line arguments
  for (const [key, value] of Object.entries(overrides)) {
    args.push(`--override`, `${key}=${value}`);
  }
  
  return new Promise((resolve, reject) => {
    const proc = spawn('stripe', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Stripe trigger ${eventName} completed`);
        resolve();
      } else {
        console.error('Stripe trigger output:', output);
        console.error('Stripe trigger error:', errorOutput);
        reject(new Error(`Stripe trigger failed with code ${code}: ${errorOutput}`));
      }
    });
    
    proc.on('error', (error) => {
      reject(error);
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Stripe trigger timeout for event: ${eventName}`));
    }, 30000);
  });
}

/**
 * Stop Stripe listen process
 */
export async function stripeListenStop(): Promise<void> {
  if (!stripeListenProcess) {
    console.log('No Stripe listen process to stop');
    return;
  }
  
  console.log('🛑 Stopping Stripe listen');
  
  return new Promise((resolve) => {
    if (!stripeListenProcess) {
      resolve();
      return;
    }
    
    const proc = stripeListenProcess.process;
    stripeListenProcess = null;
    
    proc.on('close', () => {
      console.log('✅ Stripe listen stopped');
      resolve();
    });
    
    // Send SIGTERM first
    proc.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch (error) {
        // Process might already be dead
      }
      resolve();
    }, 5000);
  });
}

/**
 * Wait for webhook to be processed
 */
export async function waitForWebhookProcessing(delayMs = 2000): Promise<void> {
  console.log(`⏳ Waiting ${delayMs}ms for webhook processing...`);
  await sleep(delayMs);
}

/**
 * Trigger checkout session completed event
 */
export async function triggerCheckoutCompleted(customerId?: string): Promise<void> {
  const overrides: Record<string, any> = {};
  
  if (customerId) {
    overrides['customer'] = customerId;
  }
  
  await stripeTrigger('checkout.session.completed', overrides);
  await waitForWebhookProcessing();
}

/**
 * Trigger customer subscription created event
 */
export async function triggerSubscriptionCreated(customerId?: string): Promise<void> {
  const overrides: Record<string, any> = {
    'status': 'active',
    'current_period_start': Math.floor(Date.now() / 1000),
    'current_period_end': Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  };
  
  if (customerId) {
    overrides['customer'] = customerId;
  }
  
  await stripeTrigger('customer.subscription.created', overrides);
  await waitForWebhookProcessing();
}

/**
 * Trigger customer subscription deleted event (cancellation)
 */
export async function triggerSubscriptionDeleted(customerId?: string): Promise<void> {
  const overrides: Record<string, any> = {
    'status': 'canceled',
    'canceled_at': Math.floor(Date.now() / 1000)
  };
  
  if (customerId) {
    overrides['customer'] = customerId;
  }
  
  await stripeTrigger('customer.subscription.deleted', overrides);
  await waitForWebhookProcessing();
}

/**
 * Check if Stripe webhooks are properly configured
 */
export async function validateStripeSetup(): Promise<{ valid: boolean; message: string }> {
  if (!isStripeE2EEnabled()) {
    return {
      valid: false,
      message: 'E2E_STRIPE=1 not set. Stripe tests will be skipped.'
    };
  }
  
  if (!(await isStripeCLIAvailable())) {
    return {
      valid: false,
      message: 'Stripe CLI not available. Install with: brew install stripe/stripe-cli/stripe'
    };
  }
  
  // Test stripe auth
  return new Promise((resolve) => {
    const proc = spawn('stripe', ['config', '--list'], { stdio: 'pipe' });
    
    let output = '';
    
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0 && output.includes('test_')) {
        resolve({
          valid: true,
          message: 'Stripe CLI configured and authenticated'
        });
      } else {
        resolve({
          valid: false,
          message: 'Stripe CLI not authenticated. Run: stripe login'
        });
      }
    });
    
    proc.on('error', () => {
      resolve({
        valid: false,
        message: 'Failed to check Stripe CLI configuration'
      });
    });
    
    setTimeout(() => {
      proc.kill();
      resolve({
        valid: false,
        message: 'Stripe CLI configuration check timeout'
      });
    }, 10000);
  });
}

/**
 * Utility to clean up Stripe processes on test suite exit
 */
export async function cleanupStripeProcesses(): Promise<void> {
  await stripeListenStop();
}