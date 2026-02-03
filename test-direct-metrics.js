
const METRIKA_API_BASE = 'https://api-metrika.yandex.net/stat/v1/data';

async function testMetrika() {
    const token = 'y0__xDfxb1gGNq_NyDAivKjFqYkr66aXNxZXnyS_T_w7GA7TD3F';
    const counterId = '93215285'; // Does ad reports work with counter ID? Maybe requires direct_client_logins?

    console.log('--- Checking ym:ad Scope Metrics ---');

    await fetchMetrics(token, counterId, {
        'metrics': 'ym:ad:clicks',
        'limit': '1',
    }, 'ym:ad:clicks');

    await fetchMetrics(token, counterId, {
        'metrics': 'ym:ad:cost', // Trying common name
        'limit': '1',
    }, 'ym:ad:cost');

    await fetchMetrics(token, counterId, {
        'metrics': 'ym:ad:sumAdCosts',
        'limit': '1',
    }, 'ym:ad:sumAdCosts');

    await fetchMetrics(token, counterId, {
        'metrics': 'ym:ad:rub',
        'limit': '1',
    }, 'ym:ad:rub');

    // Try combining with direct_client_logins if possible (need to know login? Maybe skip)
}

async function fetchMetrics(token, counterId, extraParams, testName) {
    const params = new URLSearchParams({
        'ids': counterId,
        'accuracy': 'low',
        'date1': 'today',
        'date2': 'today',
        ...extraParams
    });

    try {
        const res = await fetch(`${METRIKA_API_BASE}?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`[${testName}] Status: ${res.status}`);
        if (!res.ok) {
            console.log(`[${testName}] Error:`, await res.text());
        } else {
            console.log(`[${testName}] Success!`);
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                console.log(`[${testName}] Sample Data:`, JSON.stringify(data.data[0]));
            } else {
                console.log(`[${testName}] No data rows returned (Empty)`);
            }
        }
    } catch (e) {
        console.error(`[${testName}] Fetch error:`, e);
    }
}

testMetrika();
