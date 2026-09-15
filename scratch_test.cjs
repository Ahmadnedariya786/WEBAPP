const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [k, ...v] = line.split('=');
      return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
    })
);

async function run() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/?apikey=${env.VITE_SUPABASE_ANON_KEY}`);
  const json = await res.json();
  const rpcs = Object.keys(json.paths).filter(p => p.startsWith('/rpc/fn_'));
  for (const rpc of rpcs) {
    console.log(rpc, JSON.stringify(json.paths[rpc].post.parameters, null, 2));
  }
}
run();
