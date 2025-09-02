# 🌙 Day Dream Dictionary - Task Management System

A fully functional, interactive task management system for tracking your Day Dream Dictionary development progress.

## Features

✨ **Interactive Task Management**
- View all 49 development tasks across 10 phases
- Update task status (To Do, In Progress, Done, Blocked)
- Real-time progress tracking with visual indicators
- Automatic progress calculation per phase and overall

📊 **Smart Filtering & Search**
- Filter by phase, status, or priority
- Search tasks by ID, name, or description
- Expand/collapse phases for better organization

💾 **Data Persistence**
- Automatically saves progress to browser localStorage
- Preserves task status between sessions
- Export progress to Markdown or JSON formats

🎨 **Professional UI**
- Beautiful gradient design with smooth animations
- Responsive layout that works on all devices
- Color-coded status indicators
- Priority badges (High, Medium, Low)

## Quick Start

### Option 1: Direct Browser Opening (Limited Functionality)
Simply open `task-manager.html` in your browser. The application will work with embedded task data.

```bash
# Windows
start task-manager.html

# Mac
open task-manager.html

# Linux
xdg-open task-manager.html
```

### Option 2: Local Server (Full Functionality) - Recommended
For full functionality including loading tasks.md file:

```bash
# Windows - Run the provided batch file
serve.bat

# Or use Python directly
python -m http.server 8080

# Then open in browser
http://localhost:8080/task-manager.html
```

### Option 3: Using Node.js
```bash
# Install http-server globally
npm install -g http-server

# Start the server
http-server -p 8080

# Open in browser
http://localhost:8080/task-manager.html
```

## Usage Guide

### Managing Tasks

1. **View Tasks**: All tasks are organized by phase with clear visual hierarchy
2. **Update Status**: Click on any task's status dropdown to change it:
   - **To Do** (Yellow) - Task not started
   - **In Progress** (Blue) - Currently working on
   - **Done** (Green) - Completed
   - **Blocked** (Red) - Blocked by dependencies

3. **Track Progress**: 
   - Overall statistics shown at the top
   - Individual phase progress bars
   - Real-time updates as you change task status

### Filtering & Search

- **Phase Filter**: View tasks from specific phases
- **Status Filter**: Show only tasks with certain status
- **Priority Filter**: Focus on high, medium, or low priority tasks
- **Search**: Type keywords to find specific tasks instantly

### Data Management

- **Save Progress**: Click "💾 Save Progress" to manually save (auto-saves on changes)
- **Export to Markdown**: Generate a markdown report of current progress
- **Export to JSON**: Export structured data for integration with other tools
- **Reset All**: Reset all tasks back to "To Do" status

## File Structure

```
day-dream-dictionary/
├── task-manager.html     # Main application file
├── task-manager.js       # JavaScript logic and functionality
├── tasks.md             # Source task data (your original file)
├── serve.bat            # Windows batch file to start local server
└── README-TaskManager.md # This documentation
```

## Technical Details

- **Pure JavaScript**: No framework dependencies
- **localStorage API**: For data persistence
- **Responsive Design**: Mobile-friendly interface
- **CORS Handling**: Fallback to embedded data when needed

## Customization

### Modifying Tasks
Edit the `tasks.md` file to update task information. The system will load the updated tasks on next refresh.

### Styling
All styles are embedded in `task-manager.html`. Modify the CSS section to customize colors, fonts, or layout.

### Adding Features
The modular JavaScript structure in `task-manager.js` makes it easy to extend functionality.

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Opera

## Troubleshooting

**Issue**: Tasks not loading from tasks.md
- **Solution**: Use a local server (see Quick Start Option 2)

**Issue**: Progress not saving
- **Solution**: Check if localStorage is enabled in your browser

**Issue**: Export not working
- **Solution**: Allow pop-ups/downloads for the application

## Future Enhancements

Potential features for future versions:
- Task dependencies visualization
- Time tracking per task
- Team collaboration features
- Integration with project management APIs
- Gantt chart view
- Burndown charts

## Support

For issues or questions about the Day Dream Dictionary Task Manager, please refer to the main project documentation.

---

Built with ❤️ for the Day Dream Dictionary project