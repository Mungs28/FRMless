const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabaseUrl = 'https://cfoopqwjbwirgfiyyzar.supabase.co';
const supabaseAnonKey = 'sb_publishable_XU3uCOLod3xbhxAtaU-8hQ_-bG4gvCX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchDailyBriefs() {
  console.log("📰 Fetching today's current affairs and banking news...");

  try {
    const parser = new Parser();
    
    // Using a dedicated UPSC/Banking Current Affairs feed for full paragraphs
    const feed = await parser.parseURL('https://www.insightsonindia.com/feed/');
    
    // Extract the top 20 most recent headlines
    const briefs = feed.items.slice(0, 20).map(item => {
      // Grab the longest text available from the feed
      let fullText = item.contentSnippet || item.content || 'Tap to read full GK update.';
      // Clean up random HTML tags if the feed includes them
      fullText = fullText.replace(/(<([^>]+)>)/gi, "").trim();
      
      return {
        title: item.title,
        // Only append '...' if the text actually exceeds 500 characters
        summary: fullText.length > 500 ? fullText.substring(0, 500) + '...' : fullText,
        link: item.link,
        published_date: new Date(item.pubDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      };
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