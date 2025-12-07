-- Migration: Seed verses table with popular biblical verses
-- Created: 2025-01-15
-- Description: Inserts initial set of popular verses for daily rotation

-- Popular verses from various books of the Bible
INSERT INTO verses (reference, text, book, chapter, verse, translation, theme) VALUES
  ('John 3:16', 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.', 'John', 3, 16, 'NIV', '["love", "salvation", "faith"]'),
  ('Philippians 4:13', 'I can do all this through him who gives me strength.', 'Philippians', 4, 13, 'NIV', '["strength", "perseverance", "faith"]'),
  ('Jeremiah 29:11', 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.', 'Jeremiah', 29, 11, 'NIV', '["hope", "future", "trust"]'),
  ('Proverbs 3:5-6', 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.', 'Proverbs', 3, 5, 'NIV', '["trust", "guidance", "wisdom"]'),
  ('Romans 8:28', 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.', 'Romans', 8, 28, 'NIV', '["purpose", "trust", "love"]'),
  ('Psalm 23:1', 'The LORD is my shepherd, I lack nothing.', 'Psalms', 23, 1, 'NIV', '["provision", "trust", "peace"]'),
  ('Isaiah 41:10', 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.', 'Isaiah', 41, 10, 'NIV', '["courage", "strength", "comfort"]'),
  ('Matthew 11:28', 'Come to me, all you who are weary and burdened, and I will give you rest.', 'Matthew', 11, 28, 'NIV', '["rest", "comfort", "peace"]'),
  ('Psalm 46:1', 'God is our refuge and strength, an ever-present help in trouble.', 'Psalms', 46, 1, 'NIV', '["strength", "refuge", "help"]'),
  ('Joshua 1:9', 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.', 'Joshua', 1, 9, 'NIV', '["courage", "strength", "presence"]'),
  ('Proverbs 16:3', 'Commit to the LORD whatever you do, and he will establish your plans.', 'Proverbs', 16, 3, 'NIV', '["commitment", "trust", "guidance"]'),
  ('1 Corinthians 13:4-5', 'Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It does not dishonor others, it is not self-seeking, it is not easily angered, it keeps no record of wrongs.', '1 Corinthians', 13, 4, 'NIV', '["love", "patience", "kindness"]'),
  ('Psalm 119:105', 'Your word is a lamp for my feet, a light on my path.', 'Psalms', 119, 105, 'NIV', '["guidance", "wisdom", "light"]'),
  ('Romans 12:2', 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God''s will is—his good, pleasing and perfect will.', 'Romans', 12, 2, 'NIV', '["transformation", "wisdom", "purpose"]'),
  ('Ephesians 2:8-9', 'For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God—not by works, so that no one can boast.', 'Ephesians', 2, 8, 'NIV', '["grace", "salvation", "faith"]'),
  ('Psalm 27:1', 'The LORD is my light and my salvation—whom shall I fear? The LORD is the stronghold of my life—of whom shall I be afraid?', 'Psalms', 27, 1, 'NIV', '["courage", "salvation", "strength"]'),
  ('Matthew 6:33', 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.', 'Matthew', 6, 33, 'NIV', '["priority", "trust", "provision"]'),
  ('Galatians 5:22-23', 'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law.', 'Galatians', 5, 22, 'NIV', '["fruit", "spirit", "character"]'),
  ('Isaiah 40:31', 'But those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.', 'Isaiah', 40, 31, 'NIV', '["hope", "strength", "renewal"]'),
  ('2 Timothy 1:7', 'For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.', '2 Timothy', 1, 7, 'NIV', '["power", "love", "courage"]'),
  ('Psalm 37:4', 'Take delight in the LORD, and he will give you the desires of your heart.', 'Psalms', 37, 4, 'NIV', '["delight", "desires", "trust"]'),
  ('Hebrews 11:1', 'Now faith is confidence in what we hope for and assurance about what we do not see.', 'Hebrews', 11, 1, 'NIV', '["faith", "hope", "confidence"]'),
  ('James 1:2-3', 'Consider it pure joy, my brothers and sisters, whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance.', 'James', 1, 2, 'NIV', '["joy", "perseverance", "trials"]'),
  ('1 Peter 5:7', 'Cast all your anxiety on him because he cares for you.', '1 Peter', 5, 7, 'NIV', '["anxiety", "care", "trust"]'),
  ('Colossians 3:23', 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.', 'Colossians', 3, 23, 'NIV', '["work", "dedication", "purpose"]'),
  ('Psalm 34:8', 'Taste and see that the LORD is good; blessed is the one who takes refuge in him.', 'Psalms', 34, 8, 'NIV', '["goodness", "refuge", "blessing"]'),
  ('Romans 5:8', 'But God demonstrates his own love for us in this: While we were still sinners, Christ died for us.', 'Romans', 5, 8, 'NIV', '["love", "sacrifice", "grace"]'),
  ('Proverbs 18:10', 'The name of the LORD is a fortified tower; the righteous run to it and are safe.', 'Proverbs', 18, 10, 'NIV', '["safety", "refuge", "protection"]'),
  ('Matthew 5:16', 'In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven.', 'Matthew', 5, 16, 'NIV', '["light", "witness", "deeds"]'),
  ('Psalm 91:1-2', 'Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty. I will say of the LORD, "He is my refuge and my fortress, my God, in whom I trust."', 'Psalms', 91, 1, 'NIV', '["shelter", "trust", "protection"]');
