#!/bin/bash

# Install dependencies for Budget Buckets with Stripe integration

echo "🚀 Installing Budget Buckets dependencies..."

# Install Node.js dependencies
npm install

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your apphosting.yaml secrets are configured in Firebase"
echo "2. Set up your Stripe webhook endpoint at: /api/billing/webhook"
echo "3. Configure your Stripe Customer Portal settings in the Stripe Dashboard"
echo "4. Deploy to Firebase App Hosting"
echo ""
echo "🔗 Webhook URL for Stripe: https://your-domain.web.app/api/billing/webhook"
echo ""
echo "📚 Required Stripe webhook events:"
echo "   • customer.subscription.created"
echo "   • customer.subscription.updated" 
echo "   • customer.subscription.deleted"
echo "   • invoice.payment_succeeded"
echo "   • invoice.payment_failed"
echo ""
echo "🎉 Ready to run: npm start"