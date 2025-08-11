// Quick test script to verify deployment API
const testDeployment = async () => {
  const testData = {
    formData: {
      name: "My Test Collection",
      symbol: "TEST", 
      description: "Testing deployment",
      price: "0",
      supply: "100"
    },
    assets: [],
    walletAddress: "11111111111111111111111111111112", // Test wallet address
    network: "mainnet-beta"
  };

  try {
    console.log('🚀 Testing deployment API...');
    
    const response = await fetch('http://localhost:3000/api/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Deployment API is working!');
      console.log('📦 Collection created:', {
        id: result.collection.id,
        name: result.collection.name,
        symbol: result.collection.symbol,
        price: result.collection.price,
        supply: result.collection.itemsAvailable,
        status: result.collection.status
      });
    } else {
      console.log('❌ Deployment failed:', result.error);
      console.log('Details:', result.details);
    }
  } catch (error) {
    console.log('❌ API call failed:', error.message);
  }
};

testDeployment();
