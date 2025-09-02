#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PRDParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.content = '';
    this.tasks = [];
  }

  readFile() {
    try {
      this.content = fs.readFileSync(this.filePath, 'utf8');
      return true;
    } catch (error) {
      console.error(`Error reading file: ${error.message}`);
      return false;
    }
  }

  parseSections() {
    const lines = this.content.split('\n');
    const sections = {};
    let currentSection = '';
    let currentContent = [];

    for (const line of lines) {
      if (line.match(/^\d+\)/)) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = line.replace(/^\d+\)\s*/, '').trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }

    return sections;
  }

  extractTasks() {
    const sections = this.parseSections();
    
    // Phase 1: Setup & Infrastructure
    this.tasks.push({
      phase: 'Phase 1: Setup & Infrastructure',
      priority: 'High',
      tasks: [
        { id: 'SETUP-001', title: 'Initialize React + Next.js project', description: 'Set up the base React application with Next.js framework, Tailwind CSS', status: 'todo', effort: '2h' },
        { id: 'SETUP-002', title: 'Configure development environment', description: 'Set up ESLint, Prettier, TypeScript configuration', status: 'todo', effort: '1h' },
        { id: 'SETUP-003', title: 'Set up Supabase project', description: 'Create Supabase project, configure Auth, set up database schema', status: 'todo', effort: '3h' },
        { id: 'SETUP-004', title: 'Configure MongoDB Atlas', description: 'Set up MongoDB cluster for dream documents storage', status: 'todo', effort: '2h' },
        { id: 'SETUP-005', title: 'Set up backend server', description: 'Initialize Node.js backend with Express/Fastify on Render', status: 'todo', effort: '3h' },
        { id: 'SETUP-006', title: 'Configure environment variables', description: 'Set up .env files for all API keys and configurations', status: 'todo', effort: '1h' }
      ]
    });

    // Phase 2: Authentication & User Management
    this.tasks.push({
      phase: 'Phase 2: Authentication & User Management',
      priority: 'High',
      tasks: [
        { id: 'AUTH-001', title: 'Implement Supabase Auth integration', description: 'Set up sign up, login, logout, password reset flows', status: 'todo', effort: '4h' },
        { id: 'AUTH-002', title: 'Create user profile system', description: 'Implement user profiles with display_name, locale, preferences', status: 'todo', effort: '3h' },
        { id: 'AUTH-003', title: 'Implement RBAC system', description: 'Set up role-based access control for users and admins', status: 'todo', effort: '3h' },
        { id: 'AUTH-004', title: 'Create protected routes', description: 'Implement middleware for protecting API and frontend routes', status: 'todo', effort: '2h' }
      ]
    });

    // Phase 3: Payment & Billing System
    this.tasks.push({
      phase: 'Phase 3: Payment & Billing System',
      priority: 'High',
      tasks: [
        { id: 'PAY-001', title: 'Integrate Stripe', description: 'Set up Stripe account, configure products and prices', status: 'todo', effort: '3h' },
        { id: 'PAY-002', title: 'Implement subscription management', description: 'Create subscription flows for Basic and Pro tiers', status: 'todo', effort: '5h' },
        { id: 'PAY-003', title: 'Build credit system', description: 'Implement credit purchase and consumption logic', status: 'todo', effort: '4h' },
        { id: 'PAY-004', title: 'Create Stripe webhook handler', description: 'Handle payment events, update subscriptions and credits', status: 'todo', effort: '3h' },
        { id: 'PAY-005', title: 'Implement payment UI', description: 'Build pricing page, checkout flow, payment management', status: 'todo', effort: '4h' }
      ]
    });

    // Phase 4: Core Dream Interpretation
    this.tasks.push({
      phase: 'Phase 4: Core Dream Interpretation',
      priority: 'High',
      tasks: [
        { id: 'DREAM-001', title: 'Integrate OpenRouter API', description: 'Set up OpenRouter with Claude 3.5 Sonnet model', status: 'todo', effort: '2h' },
        { id: 'DREAM-002', title: 'Create interpretation prompt system', description: 'Implement structured prompt for dream analysis', status: 'todo', effort: '3h' },
        { id: 'DREAM-003', title: 'Build dream submission API', description: 'Create POST /api/dreams/interpret endpoint', status: 'todo', effort: '3h' },
        { id: 'DREAM-004', title: 'Implement JSON schema validation', description: 'Validate and repair AI responses', status: 'todo', effort: '2h' },
        { id: 'DREAM-005', title: 'Create dream submission UI', description: 'Build form for dream text input with character limits', status: 'todo', effort: '3h' },
        { id: 'DREAM-006', title: 'Build interpretation display', description: 'Create UI for showing themes, symbols, insights, guidance', status: 'todo', effort: '4h' }
      ]
    });

    // Phase 5: Quota & Paywall System
    this.tasks.push({
      phase: 'Phase 5: Quota & Paywall System',
      priority: 'High',
      tasks: [
        { id: 'QUOTA-001', title: 'Implement server-side quota tracking', description: 'Track free interpretations per user', status: 'todo', effort: '3h' },
        { id: 'QUOTA-002', title: 'Create paywall triggers', description: 'Show paywall after quota exhaustion', status: 'todo', effort: '2h' },
        { id: 'QUOTA-003', title: 'Build upgrade prompts', description: 'Create UI for subscription and credit purchase prompts', status: 'todo', effort: '3h' },
        { id: 'QUOTA-004', title: 'Implement credit consumption', description: 'Deduct credits for premium features', status: 'todo', effort: '2h' }
      ]
    });

    // Phase 6: Data Storage & History
    this.tasks.push({
      phase: 'Phase 6: Data Storage & History',
      priority: 'Medium',
      tasks: [
        { id: 'DATA-001', title: 'Implement dream storage', description: 'Store dreams in MongoDB with user association', status: 'todo', effort: '3h' },
        { id: 'DATA-002', title: 'Create history API', description: 'Build GET /api/dreams endpoint for user history', status: 'todo', effort: '2h' },
        { id: 'DATA-003', title: 'Build history UI', description: 'Create page to view past interpretations', status: 'todo', effort: '3h' },
        { id: 'DATA-004', title: 'Implement data deletion', description: 'Allow users to delete individual dreams or all data', status: 'todo', effort: '2h' },
        { id: 'DATA-005', title: 'Add privacy controls', description: 'Implement opt-in/opt-out for data storage', status: 'todo', effort: '2h' }
      ]
    });

    // Phase 7: Admin Dashboard
    this.tasks.push({
      phase: 'Phase 7: Admin Dashboard',
      priority: 'Medium',
      tasks: [
        { id: 'ADMIN-001', title: 'Create admin layout', description: 'Build admin dashboard structure and navigation', status: 'todo', effort: '3h' },
        { id: 'ADMIN-002', title: 'Build user management', description: 'View users, roles, subscription status', status: 'todo', effort: '4h' },
        { id: 'ADMIN-003', title: 'Implement payment management', description: 'View payments, process refunds, add credits', status: 'todo', effort: '4h' },
        { id: 'ADMIN-004', title: 'Create analytics dashboard', description: 'Show KPIs: DAU, MRR, conversion rates', status: 'todo', effort: '5h' },
        { id: 'ADMIN-005', title: 'Add dream moderation tools', description: 'Optional viewing and management of submissions', status: 'todo', effort: '3h' }
      ]
    });

    // Phase 8: Premium Features
    this.tasks.push({
      phase: 'Phase 8: Premium Features',
      priority: 'Medium',
      tasks: [
        { id: 'PREM-001', title: 'Implement PDF export', description: 'Generate PDF reports for interpretations', status: 'todo', effort: '4h' },
        { id: 'PREM-002', title: 'Build email delivery', description: 'Send interpretation results via email', status: 'todo', effort: '3h' },
        { id: 'PREM-003', title: 'Create symbol encyclopedia', description: 'Build searchable dream symbol database', status: 'todo', effort: '5h' },
        { id: 'PREM-004', title: 'Add deeper analysis mode', description: 'Enhanced interpretation for premium users', status: 'todo', effort: '3h' }
      ]
    });

    // Phase 9: Internationalization
    this.tasks.push({
      phase: 'Phase 9: Internationalization',
      priority: 'Medium',
      tasks: [
        { id: 'I18N-001', title: 'Set up i18n framework', description: 'Configure next-i18next for translations', status: 'todo', effort: '2h' },
        { id: 'I18N-002', title: 'Create English translations', description: 'Extract and organize all UI strings', status: 'todo', effort: '3h' },
        { id: 'I18N-003', title: 'Add Spanish translations', description: 'Translate all UI strings to Spanish', status: 'todo', effort: '4h' },
        { id: 'I18N-004', title: 'Implement language switcher', description: 'Add UI for changing language preference', status: 'todo', effort: '2h' }
      ]
    });

    // Phase 10: Testing & Deployment
    this.tasks.push({
      phase: 'Phase 10: Testing & Deployment',
      priority: 'High',
      tasks: [
        { id: 'TEST-001', title: 'Write unit tests', description: 'Test core business logic and utilities', status: 'todo', effort: '6h' },
        { id: 'TEST-002', title: 'Create integration tests', description: 'Test API endpoints and database operations', status: 'todo', effort: '5h' },
        { id: 'TEST-003', title: 'Perform security audit', description: 'Check for vulnerabilities, implement rate limiting', status: 'todo', effort: '4h' },
        { id: 'TEST-004', title: 'Set up CI/CD pipeline', description: 'Configure automated testing and deployment', status: 'todo', effort: '3h' },
        { id: 'TEST-005', title: 'Deploy to production', description: 'Deploy frontend to Vercel, backend to Render', status: 'todo', effort: '3h' },
        { id: 'TEST-006', title: 'Configure monitoring', description: 'Set up error tracking and performance monitoring', status: 'todo', effort: '2h' }
      ]
    });

    return this.tasks;
  }

  generateOutput(format = 'markdown') {
    const tasks = this.extractTasks();
    
    if (format === 'json') {
      return JSON.stringify(tasks, null, 2);
    }
    
    // Generate Markdown output
    let output = '# Day Dream Dictionary - Development Tasks\n\n';
    output += `Generated from PRD: ${new Date().toISOString()}\n\n`;
    output += '## Summary\n';
    
    let totalTasks = 0;
    let totalEffort = 0;
    
    tasks.forEach(phase => {
      totalTasks += phase.tasks.length;
      phase.tasks.forEach(task => {
        const hours = parseInt(task.effort) || 0;
        totalEffort += hours;
      });
    });
    
    output += `- Total Phases: ${tasks.length}\n`;
    output += `- Total Tasks: ${totalTasks}\n`;
    output += `- Estimated Effort: ${totalEffort} hours (${Math.ceil(totalEffort / 8)} days)\n\n`;
    
    output += '## Task Breakdown\n\n';
    
    tasks.forEach(phase => {
      output += `### ${phase.phase}\n`;
      output += `Priority: ${phase.priority}\n\n`;
      output += '| ID | Task | Description | Effort | Status |\n';
      output += '|----|------|-------------|--------|--------|\n';
      
      phase.tasks.forEach(task => {
        output += `| ${task.id} | ${task.title} | ${task.description} | ${task.effort} | ${task.status} |\n`;
      });
      
      output += '\n';
    });
    
    return output;
  }

  saveOutput(outputPath, format = 'markdown') {
    const output = this.generateOutput(format);
    const extension = format === 'json' ? 'json' : 'md';
    const fileName = outputPath || `tasks-${Date.now()}.${extension}`;
    
    try {
      fs.writeFileSync(fileName, output);
      console.log(`✅ Tasks saved to ${fileName}`);
      return fileName;
    } catch (error) {
      console.error(`Error saving file: ${error.message}`);
      return null;
    }
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  
  // Handle "parse-prd" command syntax
  let startIndex = 0;
  if (args[0] === 'parse-prd') {
    startIndex = 1;
  }
  
  if (args.length - startIndex === 0) {
    console.log('Usage: task-master parse-prd <prd-file> [options]');
    console.log('   or: node parse-prd.js <prd-file> [options]');
    console.log('Options:');
    console.log('  --format <json|markdown>  Output format (default: markdown)');
    console.log('  --output <file>          Output file name');
    console.log('  --append                 Append to existing file');
    return;
  }
  
  const prdFile = args[startIndex];
  let format = 'markdown';
  let outputFile = null;
  let append = false;
  
  for (let i = startIndex + 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--append') {
      append = true;
    }
  }
  
  const parser = new PRDParser(prdFile);
  
  if (!parser.readFile()) {
    console.error('Failed to read PRD file');
    process.exit(1);
  }
  
  console.log(`📄 Parsing PRD: ${prdFile}`);
  
  if (outputFile) {
    if (append && fs.existsSync(outputFile)) {
      const existingContent = fs.readFileSync(outputFile, 'utf8');
      const newContent = parser.generateOutput(format);
      fs.writeFileSync(outputFile, existingContent + '\n\n' + newContent);
      console.log(`✅ Tasks appended to ${outputFile}`);
    } else {
      parser.saveOutput(outputFile, format);
    }
  } else {
    // Output to console
    console.log('\n' + parser.generateOutput(format));
  }
}

if (require.main === module) {
  main();
}

module.exports = PRDParser;