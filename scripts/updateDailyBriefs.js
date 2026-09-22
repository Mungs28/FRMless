const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabaseUrl = 'https://cfoopqwjbwirgfiyyzar.supabase.co';
const supabaseAnonKey = 'sb_publishable_XU3uCOLod3xbhxAtaU-8hQ_-bG4gvCX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchDailyBriefs() {
  console.log("📰 Fetching today's current affairs and banking news...");

  try {
    const parser = new Parser();
    
    // Fetch from a source that provides real descriptive paragraphs for exam prep
    const feed = await parser.parseURL('https://indianexpress.com/section/explained/feed/');
    
    // Extract the top 20 most recent headlines
    const briefs = feed.items.slice(0, 20).map(item => {
      return {
        title: item.title.substring(0, 100),
        summary: item.contentSnippet ? item.contentSnippet.substring(0, 500) + '...' : 'Tap to read the full GK/Current Affairs update.',
        link: item.link,
        published_date: new Date(item.pubDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      };
    });
    });

    console.log("🧹 Clearing yesterday's briefs from the database...");
    await supabase.from('daily_briefs').delete().neq('id', 0);

    console.log("✍️ Pushing fresh briefs to Supabase...");
    const { error } = await supabase.from('daily_briefs').insert(briefs);
    
    if (error) throw error;
    console.log("🎉 Success! Your Daily Brief hero card is now loaded with live internet data.");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

fetchDailyBriefs();