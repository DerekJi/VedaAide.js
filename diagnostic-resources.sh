#!/bin/bash

echo "��� Diagnosing Azure Resources..."
echo ""

SUBSCRIPTION_ID="02a35f91-5ef5-4ebb-9fdf-9143c7e5f3b0"

echo "1️⃣ Checking Cosmos DB:"
az cosmosdb database-accounts list \
  --query "[].{name, endpoint: documentEndpoint, status: provisioningState}" \
  -o table 2>/dev/null || echo "❌ Cannot list Cosmos accounts"
echo ""

echo "2️⃣ Checking Azure OpenAI:"
az cognitiveservices account list \
  --query "[?kind=='OpenAI'].{name, endpoint, kind}" \
  -o table 2>/dev/null || echo "❌ Cannot list OpenAI accounts"
echo ""

echo "3️⃣ Checking Existing Container Apps:"
az containerapp list --query "[].{name, env: managedEnvironmentId}" -o table 2>/dev/null || echo "❌ No container apps"
echo ""

echo "4️⃣ Checking Existing Resource Groups:"
az group list --query "[?starts_with(name, 'vedaaide')].{name, location}" -o table 2>/dev/null || echo "❌ No matching resource groups"
echo ""

echo "✅ Diagnostic complete"
