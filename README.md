# 🌙 Day Dream Dictionary

A comprehensive dream interpretation application with an integrated task management system for development tracking.

## 🎯 Project Overview

Day Dream Dictionary is a web application that combines:
- **Task Management System** - Track development progress across 49 tasks in 10 phases
- **Dream Interpretation** (Coming Soon) - AI-powered dream analysis using Claude 3.5 Sonnet
- **User Management** (Coming Soon) - Authentication and user profiles
- **Payment System** (Coming Soon) - Subscription tiers and credit system

## 🚀 Quick Start

### For Render.com Deployment

**Start Command:** `npm start`

This is the command Render.com uses to start your application.

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/day-dream-dictionary.git
cd day-dream-dictionary
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

4. **Open in browser:**
```
http://localhost:3000
```

## 📁 Project Structure

```
day-dream-dictionary/
├── server.js              # Express server (entry point)
├── package.json           # Node.js dependencies and scripts
├── task-manager.html      # Task management interface
├── task-manager.js        # Task management logic
├── tasks.md              # Development tasks data
├── PRD.md                # Product Requirements Document
├── DEPLOY-TO-RENDER.md   # Render deployment guide
├── .env.example          # Environment variables template
└── .gitignore            # Git ignore rules
```

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Deployment:** Render.com
- **Storage:** Browser localStorage (currently), MongoDB Atlas (planned)
- **Future:** React, Next.js, Supabase, Stripe, OpenRouter API

## 📊 Current Features

### Task Management System ✅
- View all 49 development tasks across 10 phases
- Update task status (To Do, In Progress, Done, Blocked)
- Real-time progress tracking
- Filter by phase, status, or priority
- Search functionality
- Export to Markdown or JSON
- Data persistence with localStorage

## 🔮 Planned Features

Based on the PRD, upcoming features include:

### Phase 1-3: Foundation
- [ ] React + Next.js migration
- [ ] Supabase authentication
- [ ] Stripe payment integration

### Phase 4-5: Core Features
- [ ] OpenRouter API integration
- [ ] Dream interpretation engine
- [ ] Quota and paywall system

### Phase 6-10: Advanced Features
- [ ] MongoDB dream storage
- [ ] Admin dashboard
- [ ] PDF export
- [ ] Email delivery
- [ ] Internationalization (English/Spanish)

## 🚀 Deployment

### Render.com Configuration

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Environment:** Node

**Port:** Application uses `process.env.PORT || 3000`

For detailed deployment instructions, see [DEPLOY-TO-RENDER.md](./DEPLOY-TO-RENDER.md)

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
NODE_ENV=production
# Add other variables as needed
```

## 📝 Development Tasks

Track development progress at `/task-manager.html`

**Summary:**
- Total Phases: 10
- Total Tasks: 49
- Estimated Effort: 150 hours

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🌟 Acknowledgments

- Built with Node.js and Express
- Deployed on Render.com
- Task management system for tracking development progress

## 📞 Support

For deployment issues, refer to:
- [DEPLOY-TO-RENDER.md](./DEPLOY-TO-RENDER.md) - Deployment guide
- [README-TaskManager.md](./README-TaskManager.md) - Task manager documentation

## 🎯 Start Command for Render

**The start command for Render.com is:**
```bash
npm start
```

This executes `node server.js` which starts the Express server on the port provided by Render.

---

**Current Status:** Task Management System Complete ✅ | Dream Interpretation In Development 🚧