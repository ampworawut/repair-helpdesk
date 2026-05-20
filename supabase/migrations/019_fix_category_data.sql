-- Fix cases where category was stored as object string instead of main category key
UPDATE repair_cases 
SET category = 'other' 
WHERE category LIKE '{%' OR category = '[object Object]';
