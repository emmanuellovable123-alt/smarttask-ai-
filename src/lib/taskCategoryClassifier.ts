/**
 * Safe Task Category Classifier for Meet Discovery
 * Categorizes user tasks into safe, non-sensitive categories without exposing private task details.
 * Completely deterministic, fast, zero-cost, and does not require per-card Gemini API calls.
 */

export type SafeTaskCategory =
  | 'Fitness'
  | 'Study'
  | 'Coding'
  | 'Work'
  | 'Business'
  | 'Reading'
  | 'Prayer'
  | 'Learning'
  | 'Personal Development'
  | 'Errands';

interface CategoryRule {
  category: SafeTaskCategory;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Fitness',
    keywords: [
      'gym', 'workout', 'run', 'running', 'jog', 'jogging', 'exercise', 'cardio',
      'weights', 'stretch', 'stretching', 'yoga', 'pilates', 'walk', 'walking',
      'swim', 'swimming', 'cycling', 'bike', 'pushups', 'squats', 'fitness',
      'crossfit', 'hiit', 'training', 'marathon'
    ]
  },
  {
    category: 'Coding',
    keywords: [
      'code', 'coding', 'program', 'programming', 'developer', 'react', 'python',
      'javascript', 'typescript', 'debug', 'debugging', 'github', 'deploy',
      'api', 'database', 'frontend', 'backend', 'software', 'app'
    ]
  },
  {
    category: 'Study',
    keywords: [
      'study', 'studying', 'exam', 'quiz', 'test', 'homework', 'assignment',
      'revise', 'revision', 'lecture', 'class', 'university', 'college',
      'school', 'math', 'physics', 'chemistry', 'biology', 'notes'
    ]
  },
  {
    category: 'Work',
    keywords: [
      'meeting', 'client', 'presentation', 'deck', 'proposal', 'project',
      'deadline', 'colleague', 'team', 'sync', 'status', 'deliverable',
      'report', 'interview', 'work', 'office', 'emails', 'inbox'
    ]
  },
  {
    category: 'Business',
    keywords: [
      'sales', 'invoice', 'payroll', 'budget', 'revenue', 'financial',
      'pitch', 'investor', 'contract', 'customer', 'marketing', 'campaign',
      'strategy', 'startup', 'pricing', 'commerce'
    ]
  },
  {
    category: 'Reading',
    keywords: [
      'read', 'reading', 'book', 'novel', 'chapter', 'paper', 'article',
      'pages', 'audiobook', 'literature'
    ]
  },
  {
    category: 'Prayer',
    keywords: [
      'pray', 'prayer', 'praying', 'meditate', 'meditation', 'bible', 'quran',
      'scripture', 'church', 'mosque', 'devotion', 'spiritual', 'mindfulness',
      'worship', 'gratitude'
    ]
  },
  {
    category: 'Learning',
    keywords: [
      'learn', 'learning', 'course', 'tutorial', 'lesson', 'french', 'spanish',
      'german', 'language', 'skill', 'practice', 'masterclass', 'webinar'
    ]
  },
  {
    category: 'Personal Development',
    keywords: [
      'journal', 'journaling', 'reflect', 'reflection', 'goals', 'habits',
      'routine', 'plan week', 'weekly plan', 'discipline', 'self improvement',
      'growth'
    ]
  },
  {
    category: 'Errands',
    keywords: [
      'grocery', 'groceries', 'supermarket', 'clean', 'cleaning', 'laundry',
      'dishes', 'cook', 'cooking', 'dinner', 'lunch', 'breakfast', 'prep',
      'shopping', 'pharmacy', 'chores', 'errands', 'bank', 'post office'
    ]
  }
];

// In-memory LRU-style cache
const categoryCache = new Map<string, SafeTaskCategory | null>();

/**
 * Classifies a task into a safe, non-sensitive category.
 * If no confident category is found, returns null to avoid misclassification.
 */
export function classifyTaskCategory(taskText: string): SafeTaskCategory | null {
  if (!taskText || typeof taskText !== 'string') return null;
  const clean = taskText.trim().toLowerCase();
  if (categoryCache.has(clean)) {
    return categoryCache.get(clean) || null;
  }

  // Tokenize into words
  const words = clean.split(/[\s,.;:!?()[\]{}"'/\\-]+/).filter(Boolean);

  let bestMatch: SafeTaskCategory | null = null;
  let highestScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (keyword.includes(' ')) {
        if (clean.includes(keyword)) score += 3;
      } else {
        if (words.includes(keyword)) score += 2;
        else if (clean.includes(keyword)) score += 1;
      }
    }

    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestMatch = rule.category;
    }
  }

  // Limit cache size
  if (categoryCache.size > 500) {
    categoryCache.clear();
  }
  categoryCache.set(clean, bestMatch);

  return bestMatch;
}

/**
 * Extracts unique safe categories from a list of user tasks
 */
export function extractUserTaskCategories(tasks: Array<{ taskText?: string }>): SafeTaskCategory[] {
  const categories = new Set<SafeTaskCategory>();
  for (const t of tasks) {
    if (t.taskText) {
      const cat = classifyTaskCategory(t.taskText);
      if (cat) categories.add(cat);
    }
  }
  return Array.from(categories);
}
