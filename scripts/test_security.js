/**
 * Enhanced Security Test Script
 * Tests: NoSQL injection, Prototype pollution, Schema validation, XSS sanitization
 * 
 * Run: node scripts/test_security.js
 */

const BASE_URL = 'http://localhost:4000';

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    fail: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
    test: (msg) => console.log(`${colors.blue}🧪 ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

async function makeRequest(endpoint, method, body) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { error: error.message };
    }
}

// ============ TEST CASES ============

const tests = {
    // NoSQL Injection Tests (Object Keys)
    noSQLInjection: [
        {
            name: 'NoSQL: $gt operator in email object',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: { "$gt": "" }, password: "test123" },
            expectBlocked: true
        },
        {
            name: 'NoSQL: $ne operator in password object',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: { "$ne": "" } },
            expectBlocked: true
        },
        {
            name: 'NoSQL: $regex in nested object',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: { "$regex": ".*", "$options": "i" }, password: "test" },
            expectBlocked: true
        },
        {
            name: 'NoSQL: $where operator',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", "$where": "1==1" },
            expectBlocked: true
        }
    ],

    // Prototype Pollution Tests
    prototypePollution: [
        {
            name: 'Prototype: __proto__ key',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: "test", "__proto__": { "admin": true } },
            expectBlocked: true
        },
        {
            name: 'Prototype: constructor key',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: "test", "constructor": { "prototype": {} } },
            expectBlocked: true
        },
        {
            name: 'Prototype: prototype key',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: "test", "prototype": { "isAdmin": true } },
            expectBlocked: true
        },
        {
            name: 'NoSQL: Dot notation in key (user.isAdmin)',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: "test", "user.isAdmin": true },
            expectBlocked: true
        }
    ],

    // Schema Validation Tests
    schemaValidation: [
        {
            name: 'Schema: Invalid email format',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "not-an-email", password: "test123" },
            expectBlocked: true,
            expectMessage: 'valid email'
        },
        {
            name: 'Schema: Missing password',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com" },
            expectBlocked: true,
            expectMessage: 'required'
        },
        {
            name: 'Schema: Short password in registration',
            endpoint: '/api/user/register',
            method: 'POST',
            body: { name: "Test", email: "test@test.com", password: "123", phone: "1234567890" },
            expectBlocked: true,
            expectMessage: 'at least 6'
        }
    ],

    // False Positive Tests (should NOT be blocked)
    falsePositives: [
        {
            name: 'False Positive: "$50 off" in message (should PASS)',
            endpoint: '/api/user/login',
            method: 'POST',
            body: { email: "test@test.com", password: "Get $50 off your next order!" },
            expectBlocked: false // Password is just a string, should not trigger
        }
    ]
};

// ============ RUN TESTS ============

async function runTests() {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('     🔒 ENHANCED SECURITY VALIDATION TESTS');
    console.log('═'.repeat(60));

    let passed = 0;
    let failed = 0;

    // NoSQL Injection Tests
    console.log('\n📋 NoSQL INJECTION TESTS (Object Keys)\n');
    for (const test of tests.noSQLInjection) {
        log.test(`Testing: ${test.name}`);
        const result = await makeRequest(test.endpoint, test.method, test.body);

        if (result.error) {
            log.fail(`Connection error: ${result.error}`);
            failed++;
        } else if (result.status === 400 && result.data.success === false) {
            log.success(`BLOCKED! (${result.status})`);
            passed++;
        } else {
            log.fail(`NOT BLOCKED! Status: ${result.status}`);
            failed++;
        }
    }

    // Prototype Pollution Tests
    console.log('\n📋 PROTOTYPE POLLUTION TESTS\n');
    for (const test of tests.prototypePollution) {
        log.test(`Testing: ${test.name}`);
        const result = await makeRequest(test.endpoint, test.method, test.body);

        if (result.error) {
            log.fail(`Connection error: ${result.error}`);
            failed++;
        } else if (result.status === 400 && result.data.success === false) {
            log.success(`BLOCKED! (${result.status})`);
            passed++;
        } else {
            log.fail(`NOT BLOCKED! Status: ${result.status}`);
            failed++;
        }
    }

    // Schema Validation Tests
    console.log('\n📋 SCHEMA VALIDATION TESTS\n');
    for (const test of tests.schemaValidation) {
        log.test(`Testing: ${test.name}`);
        const result = await makeRequest(test.endpoint, test.method, test.body);

        if (result.error) {
            log.fail(`Connection error: ${result.error}`);
            failed++;
        } else if (result.status === 400 && result.data.success === false) {
            log.success(`VALIDATED! Message: ${result.data.message?.substring(0, 50)}`);
            passed++;
        } else {
            log.fail(`NOT VALIDATED! Status: ${result.status}`);
            failed++;
        }
    }

    // False Positive Tests
    console.log('\n📋 FALSE POSITIVE TESTS (should NOT block)\n');
    for (const test of tests.falsePositives) {
        log.test(`Testing: ${test.name}`);
        const result = await makeRequest(test.endpoint, test.method, test.body);

        if (result.error) {
            log.fail(`Connection error: ${result.error}`);
            failed++;
        } else if (result.data.message?.toLowerCase().includes('malicious')) {
            // False positive - blocked when it shouldn't be
            log.fail(`FALSE POSITIVE! Legitimate input was blocked`);
            failed++;
        } else {
            log.success(`PASSED! Input was not incorrectly blocked`);
            passed++;
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('     📊 TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n  Total Tests: ${passed + failed}`);
    log.success(`Passed: ${passed}`);
    if (failed > 0) log.fail(`Failed: ${failed}`);
    console.log('\n');

    return { passed, failed };
}

runTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
