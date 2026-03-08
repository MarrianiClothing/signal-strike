"use client";

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is not final, failure is not fatal — it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The harder the battle, the sweeter the victory.", author: "Les Brown" },
  { text: "Every sale has five basic obstacles: no need, no money, no hurry, no desire, no trust.", author: "Zig Ziglar" },
  { text: "Your attitude, not your aptitude, will determine your altitude.", author: "Zig Ziglar" },
  { text: "You don't close a sale, you open a relationship if you want to build a long-term, successful enterprise.", author: "Patricia Fripp" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "It's not about having the right opportunities. It's about handling the opportunities right.", author: "Mark Hunter" },
  { text: "The difference between a successful person and others is not a lack of strength, not a lack of knowledge, but rather a lack of will.", author: "Vince Lombardi" },
  { text: "Make a customer, not a sale.", author: "Katherine Barchetti" },
  { text: "Pipeline is the lifeblood of a sales organization. Never stop prospecting.", author: "Aaron Ross" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "Go the extra mile. It's never crowded there.", author: "Wayne Dyer" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Rejection is not failure. Failure is giving up. Everybody gets rejected. It's how you handle it that determines where you'll end up.", author: "Barry Diller" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "High expectations are the key to everything.", author: "Sam Walton" },
  { text: "The best salespeople know they're the best. They take pride in their craft.", author: "Jeffrey Gitomer" },
  { text: "Always do your best. What you plant now, you will harvest later.", author: "Og Mandino" },
  { text: "Obstacles are those frightful things you see when you take your eyes off your goal.", author: "Henry Ford" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Revenue solves all known startup problems.", author: "Naval Ravikant" },
  { text: "Chase the vision, not the money. The money will end up following you.", author: "Tony Hsieh" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupery" },
  { text: "The more you sweat in practice, the less you bleed in battle.", author: "Richard Marcinko" },
  { text: "In sales, a referral is the key to the door of resistance.", author: "Bo Bennett" },
  { text: "Don't find customers for your products. Find products for your customers.", author: "Seth Godin" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "If you are not taking care of your customer, your competitor will.", author: "Bob Hooey" },
  { text: "Timing, perseverance, and ten years of trying will eventually make you look like an overnight success.", author: "Biz Stone" },
  { text: "The cave you fear to enter holds the treasure you seek.", author: "Joseph Campbell" },
  { text: "It's not what you sell, it's how you sell.", author: "Jeffrey Gitomer" },
  { text: "Ninety percent of selling is conviction and ten percent is persuasion.", author: "Shiv Khera" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "The best marketing doesn't feel like marketing.", author: "Tom Fishburne" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Wesley Snipes" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The key to success is to focus our conscious mind on things we desire, not things we fear.", author: "Brian Tracy" },
  { text: "Sales are contingent upon the attitude of the salesman, not the attitude of the prospect.", author: "W. Clement Stone" },
  { text: "Ideas are easy. Execution is everything.", author: "John Doerr" },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Every no gets me closer to a yes.", author: "Mark Cuban" },
  { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
  { text: "Clarity affords focus.", author: "Thomas Leonard" },
  { text: "Work like there is someone working 24 hours a day to take it away from you.", author: "Mark Cuban" },
  { text: "The goal is not to be perfect by the end. The goal is to be better today.", author: "Simon Sinek" },
  { text: "Winning isn't everything, but wanting to win is.", author: "Vince Lombardi" },
  { text: "If you genuinely care about the problem you're solving, you'll figure out how to solve it.", author: "Sam Altman" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Hustle in silence and let success make the noise.", author: "Unknown" },
  { text: "Revenue is vanity, profit is sanity, cash is king.", author: "Unknown" },
  { text: "The grind is the glory.", author: "Unknown" },
  { text: "Show me your pipeline and I'll show you your future.", author: "Unknown" },
  { text: "Persistence. Perfection. Patience. Power. Prioritize your passion.", author: "Criss Jami" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

export default function DailyQuote() {
  const quote = getDailyQuote();

  return (
    <div style={{
      flex: 1,
      margin: "0 24px",
      background: "linear-gradient(135deg, #111113 0%, #18150a 100%)",
      border: "1px solid #2a2510",
      borderLeft: "3px solid #C9A84C",
      borderRadius: "10px",
      padding: "12px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      minWidth: 0,
    }}>
      <span style={{
        fontSize: "28px",
        lineHeight: 1,
        color: "#C9A84C",
        fontFamily: "Georgia, serif",
        opacity: 0.7,
        marginTop: "-2px",
        flexShrink: 0,
      }}>
        &ldquo;
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: "0 0 5px 0",
          fontSize: "0.82rem",
          color: "#e4e4e7",
          lineHeight: 1.5,
          fontStyle: "italic",
          fontWeight: 700,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {quote.text}
        </p>
        <span style={{
          fontSize: "28px",
          lineHeight: 1,
          color: "#C9A84C",
          fontFamily: "Georgia, serif",
          opacity: 0.7,
          flexShrink: 0,
          display: "block",
          textAlign: "right",
          marginTop: "-4px",
        }}>
          &rdquo;
        </span>
        <p style={{
          margin: 0,
          fontSize: "0.72rem",
          color: "#C9A84C",
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>
          — {quote.author}
        </p>
      </div>
    </div>
  );
}
