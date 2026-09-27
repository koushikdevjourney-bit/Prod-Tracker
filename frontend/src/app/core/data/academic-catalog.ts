export interface AcademicSub {
  id: string;
  title: string;
  done: boolean;
  subs: AcademicSub[];
}

export interface AcademicSubject {
  id: string;
  name: string;
  stars: number;
  subs: AcademicSub[];
}

export interface AcademicTrack {
  id: string;
  name: string;
  subjects: AcademicSubject[];
}

export interface AcademicPreset {
  id: string;
  name: string;
  blurb: string;
  badge?: string;
  subjects: Array<{ name: string; stars: number; units?: string[] }>;
}

export const ACADEMIC_PRESETS: AcademicPreset[] = [
  {
    id: 'sem-5',
    name: 'Academics Sem-5',
    blurb: 'Core Semester 5 engineering curriculum with structured modules',
    badge: 'Popular',
    subjects: [
      {
        name: 'Computer Networks',
        stars: 5,
        units: ['OSI & TCP/IP Models', 'Data Link & Flow Control', 'Network Layer (Routing & IP)', 'Transport Layer (TCP/UDP)', 'Application Protocols (HTTP, DNS)'],
      },
      {
        name: 'Practical Software Engineering',
        stars: 4,
        units: ['Linux & Shell Scripting', 'SDLC Models & Agile Scrum', 'Git & CI/CD Pipelines', 'Automated Testing & QA'],
      },
      {
        name: 'Machine Learning & AI',
        stars: 4,
        units: ['Data Preprocessing & EDA', 'Supervised Regression & Classification', 'Unsupervised Clustering', 'Model Tuning & Cross-Validation'],
      },
      {
        name: 'Database Management Systems',
        stars: 5,
        units: ['ER Modeling & Relational Schema', 'Advanced SQL & Views', 'Normalization (1NF-BCNF)', 'ACID Transactions & Indexing'],
      },
    ],
  },
  {
    id: 'sem-6',
    name: 'Academics Sem-6',
    blurb: 'Sixth-semester advanced topics and specialized electives',
    badge: 'Semester',
    subjects: [
      {
        name: 'Compiler Design',
        stars: 5,
        units: ['Lexical Analysis (Lex)', 'Syntax Analysis (Yacc/Bison)', 'Intermediate Code Representation', 'Code Optimization Techniques'],
      },
      {
        name: 'Cloud Computing & DevOps',
        stars: 4,
        units: ['Cloud Architecture (AWS/GCP)', 'Docker & Containerization', 'Kubernetes Orchestration', 'Infrastructure as Code'],
      },
      {
        name: 'Information Security & Cryptography',
        stars: 4,
        units: ['Classical & Modern Ciphers', 'Public Key Encryption (RSA)', 'Hashes & Digital Signatures', 'Web Security Vulnerabilities'],
      },
      {
        name: 'Distributed Systems',
        stars: 3,
        units: ['RPC & Message Passing', 'Consensus Algorithms (Raft/Paxos)', 'Replication & Fault Tolerance'],
      },
    ],
  },
  {
    id: 'interview-prep',
    name: 'Tech Interview & Placement',
    blurb: 'Comprehensive placement syllabus covering DSA, CS fundamentals, and System Design',
    badge: 'Career',
    subjects: [
      {
        name: 'Data Structures & Algorithms',
        stars: 5,
        units: ['Arrays, Strings & Two Pointers', 'Linked Lists, Stacks & Queues', 'Trees, BST & Heaps', 'Graphs & Shortest Paths', 'Dynamic Programming Patterns'],
      },
      {
        name: 'Core Operating Systems',
        stars: 4,
        units: ['Processes, Threads & Concurrency', 'CPU Scheduling Algorithms', 'Deadlocks & Prevention', 'Memory Management & Virtual Memory'],
      },
      {
        name: 'System Design Fundamentals',
        stars: 5,
        units: ['Load Balancers & Reverse Proxies', 'Caching Strategies (Redis)', 'Database Sharding & Replication', 'Microservices & Message Queues'],
      },
    ],
  },
];

export const PRIMARY_STAR_MIN = 4;

export function countUnits(subs: AcademicSub[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (nodes: AcademicSub[]) => {
    for (const node of nodes) {
      total++;
      if (node.done) done++;
      walk(node.subs || []);
    }
  };
  walk(subs || []);
  return { done, total };
}

export function subjectProgress(subject: AcademicSubject): { done: number; total: number; percent: number } {
  const { done, total } = countUnits(subject.subs);
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function trackProgress(track: AcademicTrack): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const subject of track.subjects) {
    const u = countUnits(subject.subs);
    done += u.done;
    total += u.total;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function summarizeTrack(track: AcademicTrack) {
  const progress = trackProgress(track);
  const primary = track.subjects.filter((subject) => subject.stars >= PRIMARY_STAR_MIN).length;
  return {
    ...progress,
    subjects: track.subjects.length,
    primary,
    others: track.subjects.length - primary,
  };
}

export function searchSubjectMatches(subject: AcademicSubject, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (subject.name.toLowerCase().includes(q)) return true;
  const checkSubs = (subs: AcademicSub[]): boolean => {
    return (subs || []).some((s) => s.title.toLowerCase().includes(q) || checkSubs(s.subs || []));
  };
  return checkSubs(subject.subs || []);
}
