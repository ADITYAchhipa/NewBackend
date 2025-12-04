// Test featured properties endpoint with category filter
import fetch from 'node-fetch';

async function testWithCategory() {
    try {
        console.log('🔍 Testing featured properties with category=Apartments...\n');

        const url = 'http://localhost:4000/api/featured/properties?page=1&limit=10&category=Apartments';
        console.log(`URL: ${url}\n`);

        const response = await fetch(url);
        const data = await response.json();

        console.log('📊 Summary:');
        console.log(`- Success: ${data.success}`);
        console.log(`- Results count: ${data.results?.length || 0}`);
        console.log(`- Total: ${data.total || 0}`);
        console.log(`- Has more: ${data.hasMore}`);

        if (data.results && data.results.length > 0) {
            console.log('\n✅ Properties found!');
            console.log('\nFirst 3 properties:');
            data.results.slice(0, 3).forEach((prop, index) => {
                console.log(`\n${index + 1}. ${prop.title}`);
                console.log(`   Category: ${prop.category}`);
                console.log(`   Featured: ${prop.Featured}`);
                console.log(`   Available: ${prop.available}`);
                console.log(`   Status: ${prop.status}`);
            });
        } else {
            console.log('\n⚠️ No properties returned!');
            console.log('\nResponse:', JSON.stringify(data, null, 2));
        }

        // Test with 'all' category
        console.log('\n\n🔍 Testing with category=all...\n');
        const url2 = 'http://localhost:4000/api/featured/properties?page=1&limit=10&category=all';
        const response2 = await fetch(url2);
        const data2 = await response2.json();

        console.log('📊 Summary:');
        console.log(`- Success: ${data2.success}`);
        console.log(`- Results count: ${data2.results?.length || 0}`);
        console.log(`- Total: ${data2.total || 0}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testWithCategory();
