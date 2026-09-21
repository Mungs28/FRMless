const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

// Your real database keys
const supabaseUrl = 'https://cfoopqwjbwirgfiyyzar.supabase.co';
const supabaseAnonKey = 'sb_publishable_XU3uCOLod3xbhxAtaU-8hQ_-bG4gvCX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchTestbookExams() {
  console.log('Fetching live calendar from Testbook...');

  try {
    const { data } = await axios.get('https://testbook.com/government-exam-calendar', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const plainText = $('body').text().replace(/\s+/g, ' ');
    const exams = [];

    const regex = /(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{4})(?:OFFICIAL|TENTATIVE)?\s*(.*?)(?=Know More|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|$)/g;

    // Set today's date to midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let match;
    while ((match = regex.exec(plainText)) !== null) {
      const day = match[1].padStart(2, '0');
      const monthStr = match[2];
      const year = match[3];
      const title = match[4].trim().substring(0, 45); 

      // 1. Title Filter: Skip messy background code and URLs
      if (title.includes('http') || title.includes('&q;') || title.includes('.com') || title.length < 3) {
        continue;
      }

      const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
      const formattedDate = `${year}-${months[monthStr]}-${day}`;
      const examDateObj = new Date(formattedDate);

      // 2. Date Filter: Only keep the exam if it happens today or in the future
      if (examDateObj >= today) {
        // Calculate the actual number of days left
        const diffTime = examDateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        exams.push({
          title: title,
          exam_date: formattedDate,
          days_left: diffDays, 
          icon: '🏛️'
        });
      }
    }

   const uniqueExams = Array.from(new Set(exams.map(a => a.title)))
      .map(title => exams.find(a => a.title === title))
      .sort((a, b) => a.days_left - b.days_left); // Sorts from earliest to latest

    if (uniqueExams.length > 0) {
      console.log(`Found ${uniqueExams.length} clean UPCOMING exams! Updating database in batches...`);
      await supabase.from('exams').delete().neq('id', 0);
      
      for (let i = 0; i < uniqueExams.length; i += 50) {
        const chunk = uniqueExams.slice(i, i + 50);
        const { error } = await supabase.from('exams').insert(chunk);
        if (error) throw error;
      }
      
      console.log('✅ Calendar successfully updated with only future exams!');
    } else {
      console.log('⚠️ Could not find any clean upcoming dates.');
    }
  } catch (error) {
    console.error('Failed to scrape Testbook:', error.message);
  }
}

fetchTestbookExams();