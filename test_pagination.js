// Test pagination with excludeIds to ensure no duplicates
import fetch from 'node-fetch';

async function testPagination() {
    try {
        console.log('🔍 Testing pagination with duplicate prevention...\n');

        // First request
        const url1 = 'http://localhost:4000/api/featured/properties?page=1&limit=5&category=all';
        console.log(`Request 1: ${url1}`);
        const response1 = await fetch(url1);
        const data1 = await response1.json();

        if (!data1.success || !data1.results) {
            console.error('❌ First request failed:', data1);
            return;
        }

        const firstBatch = data1.results;
        const firstIds = firstBatch.map(p => p._id);

        console.log(`✅ First batch: ${firstBatch.length} properties`);
        firstBatch.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.title} (ID: ${p._id})`);
        });

        // Second request with excludeIds
        const excludeIdsParam = firstIds.join(',');
        const url2 = `http://localhost:4000/api/featured/properties?page=2&limit=5&category=all&excludeIds=${excludeIdsParam}`;
        console.log(`\nRequest 2: ${url2.substring(0, 100)}...`);
        const response2 = await fetch(url2);
        const data2 = await response2.json();

        if (!data2.success || !data2.results) {
            console.error('❌ Second request failed:', data2);
            return;
        }

        const secondBatch = data2.results;
        const secondIds = secondBatch.map(p => p._id);

        console.log(`\n✅ Second batch: ${secondBatch.length} properties`);
        secondBatch.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.title} (ID: ${p._id})`);
        });

        // Check for duplicates
        const duplicates = firstIds.filter(id => secondIds.includes(id));

        console.log('\n📊 Summary:');
        console.log(`- First batch: ${firstBatch.length} properties`);
        console.log(`- Second batch: ${secondBatch.length} properties`);
        console.log(`- Duplicates found: ${duplicates.length}`);
        console.log(`- Has more: ${data2.hasMore}`);
        console.log(`- Total available: ${data2.total}`);

        if (duplicates.length > 0) {
            console.log('\n❌ FAIL: Found duplicates!', duplicates);
        } else {
            console.log('\n✅ SUCCESS: No duplicates found!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPagination();
