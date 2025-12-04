// Quick test script to check featured properties endpoint
import fetch from 'node-fetch';

async function testFeaturedProperties() {
    try {
        console.log('🔍 Testing featured properties endpoint...\n');

        const url = 'http://localhost:4000/api/featured/properties?page=1&limit=10';
        console.log(`URL: ${url}\n`);

        const response = await fetch(url);
        const data = await response.json();

        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('\n📊 Summary:');
        console.log(`- Success: ${data.success}`);
        console.log(`- Results count: ${data.results?.length || 0}`);
        console.log(`- Total: ${data.total || 0}`);
        console.log(`- Has more: ${data.hasMore}`);

        if (data.results && data.results.length > 0) {
            console.log('\n✅ Properties found!');
            console.log('\nFirst property:');
            console.log(JSON.stringify(data.results[0], null, 2));
        } else {
            console.log('\n⚠️ No properties returned!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFeaturedProperties();
