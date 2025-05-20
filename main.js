const { Plugin, PluginSettingTab, Setting, Notice } = require("obsidian");

async function fetchTasks(authToken, filter) {
  try {

    // Fetch Active Tasks
    const tasksUrl = `https://api.todoist.com/rest/v2/tasks`;
    const tasks = await fetch(tasksUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }).then((response) => response.json());

    // Fetch Project Names
    const projectsUrl = `https://api.todoist.com/rest/v2/projects`;
    const projects = await fetch(projectsUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }).then((response) => response.json());

    // Fetch Completed Tasks
    let completedTasks = [];
    if (filter.includes("completed")) {
      const completedTasksUrl = `https://api.todoist.com/sync/v9/completed/get_all`;
      completedTasks = await fetch(completedTasksUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }).then((response) => response.json());

      completedTasks = completedTasks.items || [];
    }

    // Combine Active and Completed Tasks
    const allTasks = filter.includes("completed") ? [...tasks, ...completedTasks] : tasks;

    // Adjust Todoist date to local time
    function adjustToTimeZone(dateString) {
      const utcDate = new Date(dateString); // Treat the date as UTC
      const localDate = new Date(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate()
      ); // Strip out time and set to local midnight
      return localDate.toISOString().split("T")[0]; // Return in YYYY-MM-DD format
    }

    // Current local date in YYYY-MM-DD
    const today = new Date().toLocaleDateString("en-CA");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toLocaleDateString("en-CA");

    // Adjust tasks due dates
    allTasks.forEach((task) => {
      if (task.due?.date) {
        task.due.localDate = adjustToTimeZone(task.due.date);
      }
    });

    // Split AND and OR filters
    const andFilters = filter.filter((f) => f.includes("&"));
    const orFilters = filter
      .filter((f) => !f.includes("&"))
      .flatMap((f) => f.split("|").map((x) => x.trim()));

    const filteredTaskSet = new Set();

    // Fetch All Tasks
    if (!filter.length || filter.includes("all")) {
      allTasks.forEach((task) => filteredTaskSet.add(task));
    } else {

      // Handle OR Filters
      orFilters.forEach((f) => {
        if (f === "today") {
          allTasks.filter((task) => task.due?.date === today).forEach((task) => filteredTaskSet.add(task));
        } else if (f === "tomorrow") {
          allTasks.filter((task) => task.due?.date === tomorrowDate).forEach((task) => filteredTaskSet.add(task));
        } else if (f === "overdue") {
          allTasks.filter((task) => task.due?.date && task.due.date < today).forEach((task) => filteredTaskSet.add(task));
        } else if (f.startsWith("#")) {
          const projectName = f.slice(1).toLowerCase();
          const projectId = projects.find((project) => project.name.toLowerCase() === projectName)?.id;
          if (projectId) {
            allTasks.filter((task) => task.project_id === projectId).forEach((task) => filteredTaskSet.add(task));
          }
        } else if (/^p[1-4]$/.test(f)) {
          const priority = 5 - parseInt(f[1], 10); // Map p1->4, p2->3, p3->2, p4->1
          allTasks.filter((task) => task.priority === priority).forEach((task) => filteredTaskSet.add(task));
        } else if (f === "!subtask") {
          allTasks.filter((task) => !task.parent_id).forEach((task) => filteredTaskSet.add(task));
        } else if (f === "completed") {
          completedTasks.forEach((task) => filteredTaskSet.add(task));
        }
      });

      // Handle AND Filters
      andFilters.forEach((f) => {
        const conditions = f.split("&").map((x) => x.trim());
        allTasks.forEach((task) => {
          const matchesAllConditions = conditions.every((condition) => {
            if (condition === "today") {
              return task.due?.date === today;
            } else if (condition === "tomorrow") {
              return task.due?.date === tomorrowDate;
            } else if (condition === "overdue") {
              return task.due?.date && task.due.date < today;
            } else if (condition.startsWith("#")) {
              const projectName = condition.slice(1).toLowerCase();
              const projectId = projects.find((project) => project.name.toLowerCase() === projectName)?.id;
              return task.project_id === projectId;
            } else if (/^p[1-4]$/.test(condition)) {
              const priority = 5 - parseInt(condition[1], 10);
              return task.priority === priority;
            } else if (condition === "!subtask") {
              return !task.parent_id;
            } else if (condition === "completed") {
              return completedTasks.includes(task);
            }
            return false;
          });

          if (matchesAllConditions) {
            filteredTaskSet.add(task);
          }
        });
      });

      // Add Subtasks for Matching Parents
      allTasks.forEach((task) => {
        if (
          task.parent_id &&
          filteredTaskSet.has(allTasks.find((t) => t.id === task.parent_id)) &&
          !filter.includes("!subtask")
        ) {
          filteredTaskSet.add(task);
        }
      });
    }

    // Sort Filtered Tasks
    const filteredTasks = Array.from(filteredTaskSet).sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;

      const dateA = a.due?.date || "";
      const dateB = b.due?.date || "";

      const dateOrder = (date) => {
        if (!date) return 4;
        if (date < today) return 1;
        if (date === today) return 2;
        if (date === tomorrowDate) return 3;
        return 5;
      };

      return dateOrder(dateA) - dateOrder(dateB);
    });

    // Map Tasks to Parents and Projects
    const taskMap = {};
    filteredTasks.forEach((task) => {
      const parentId = task.parent_id || null;
      if (!taskMap[parentId]) taskMap[parentId] = [];
      taskMap[parentId].push({
        id: task.id,
        content: task.content,
        priority: task.priority,
        dueDate: task.due?.date || "No Due Date",
        projectId: task.project_id,
        parentId,
      });
    });

    const projectMap = projects.reduce((map, project) => {
      map[project.id] = project.name;
      return map;
    }, {});

    return { tasks: taskMap, projects: projectMap };
  } catch (e) {
    console.error("Error fetching tasks:", e);
    new Notice("Failed to fetch tasks. Check your API token or internet connection.");
    throw e;
  }
}

// function parseFilterFromMarker(marker) {
//   const match = marker.match(/\[(.+?)\]/);
//   return match ? match[1].split("|").map((filter) => filter.trim()) : [];
// }

function formatTasksWithProjects(taskData) {
  const { tasks, projects } = taskData;

  return Object.keys(projects)
    .filter((projectId) => {
      const projectTasks = tasks[null]?.filter((task) => task.projectId === projectId) || [];
      return projectTasks.length > 0;
    })
    .map((projectId) => {
      const projectName = projects[projectId];
      const projectTasks = formatTasksAsChecklist(tasks, null, projectId, 1);
      return `- ${projectName}\n${projectTasks}`;
    })
    .join("\n");
}

function formatTasksAsChecklist(taskMap, parentId = null, projectId, indentLevel) {
  const tasks = (taskMap[parentId] || []).filter((task) => task.projectId === projectId);
  const indent = "    ".repeat(indentLevel); // 4 spaces per level

  return tasks
    .map((task) => {
      const taskText = `${indent}- [ ] ${task.content}`;
      const subtasksText = formatTasksAsChecklist(taskMap, task.id, projectId, indentLevel + 1);
      return subtasksText ? `${taskText}\n${subtasksText}` : taskText;
    })
    .join("\n");
}

module.exports = class TodoistTasksPlugin extends Plugin {
  settings = {
    apiKey: ""
  };

  async onload() {
    // Load settings
    this.settings = Object.assign({}, this.settings, await this.loadData());

    // Add settings tab
    this.addSettingTab(new TodoistSettingsTab(this.app, this));

    const targetPaths = [
      "Folder/Files.md", // Specific file
      "Folder/subFolder", // or Folder
    ];

    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (!file) return;

        // Add API key check here
        if (!this.settings.apiKey) {
          new Notice("❌ Todoist API key is missing. Configure in settings.");
          return;
        }

        const filePath = file.path;

        // Use settings API key
        const authToken = this.settings.apiKey;

        // Check if the file matches the specified paths
        const isTargetFile = targetPaths.some((path) => {
          return (
            filePath === path || // Match specific file
            (path.endsWith("/") && filePath.startsWith(path)) // Match files in folder
          );
        });

        if (!isTargetFile) return; // Skip if the file doesn't match

        const fileContent = await this.app.vault.read(file);

        // Match all blocks with optional filters
        const blockRegex = /%% Todoist Start(?: \[(.+?)\])? %%([\s\S]*?)%% Todoist End(?: \[\1\])? %%/g;
        let updatedContent = fileContent;
        let matchCount = 0;
        let totalTasks = 0;
        let hasShownFetchingNotice = false;
        let match;

        while ((match = blockRegex.exec(fileContent)) !== null) {
          matchCount++;

          // Show Fetching notice only once
          if (!hasShownFetchingNotice) {
            new Notice("Fetching Todoist tasks...");
            hasShownFetchingNotice = true;
          }

          const [fullMatch, filterString] = match;

          // Parse filter
          const filter = filterString ? filterString.split("|").map((f) => f.trim()) : [];

          // Fetch tasks using the filter
          const taskData = await fetchTasks(this.settings.apiKey, filter);
          const taskCount = Object.values(taskData.tasks).flat().length;
          totalTasks += taskCount;

          if (taskCount > 0) {
            new Notice(`${taskCount} tasks found for [${filterString || "All"}].`);
          } else {
            new Notice(`No tasks found for [${filterString || "All"}].`);
          }

          const formattedTasks = formatTasksWithProjects(taskData);

          // Replace the matched block with the updated tasks
          updatedContent = updatedContent.replace(
            fullMatch,
            `%% Todoist Start${filterString ? ` [${filterString}]` : ""} %%\n${formattedTasks}\n\n%% Todoist End${filterString ? ` [${filterString}]` : ""} %%`
          );
        }

        if (matchCount === 0) {
          new Notice("Marker not found.");
        } else {
          await this.app.vault.modify(file, updatedContent);
          if (totalTasks > 0) {
            new Notice(`Tasks added.`);
          }
        }
      })
    );

    // Register command to run the plugin manually
    this.addCommand({
      id: "todoist-update",
      name: "Todoist Update",
      callback: async () => {
        if (!this.settings.apiKey) {
          new Notice("❌ Todoist API key is missing. Configure in settings.");
          return;
        }

        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("No active file found.");
          return;
        }

        const filePath = file.path;
        const fileContent = await this.app.vault.read(file);

        const blockRegex = /%% Todoist Start(?: \[(.+?)\])? %%([\s\S]*?)%% Todoist End(?: \[\1\])? %%/g;
        let updatedContent = fileContent;
        let matchCount = 0;
        let totalTasks = 0;
        let hasShownFetchingNotice = false;
        let match;

        while ((match = blockRegex.exec(fileContent)) !== null) {
          matchCount++;

          // Show Fetching notice only once
          if (!hasShownFetchingNotice) {
            new Notice("Fetching Todoist tasks...");
            hasShownFetchingNotice = true;
          }

          const [fullMatch, filterString] = match;

          // Parse filter
          const filter = filterString ? filterString.split("|").map((f) => f.trim()) : [];

          // Fetch tasks
          const taskData = await fetchTasks(this.settings.apiKey, filter);
          const taskCount = Object.values(taskData.tasks).flat().length;
          totalTasks += taskCount;

          if (taskCount > 0) {
            new Notice(`${taskCount} tasks found for [${filterString || "All"}].`);
          } else {
            new Notice(`No tasks found for [${filterString || "All"}].`);
          }

          const formattedTasks = formatTasksWithProjects(taskData);

          // Replace the matched block with the updated tasks
          updatedContent = updatedContent.replace(
            fullMatch,
            `%% Todoist Start${filterString ? ` [${filterString}]` : ""} %%\n${formattedTasks}\n\n%% Todoist End${filterString ? ` [${filterString}]` : ""} %%`
          );
        }

        if (matchCount === 0) {
          new Notice("Marker not found.");
        } else {
          await this.app.vault.modify(file, updatedContent);
          if (totalTasks > 0) {
            new Notice(`Tasks added.`);
          }
        }
      },
    });

    // Add Ribbon Menu Item
    this.addRibbonIcon("sync", "Todoist Update", async () => {
      if (!this.settings.apiKey) {
        new Notice("❌ Todoist API key is missing. Configure in settings.");
        return;
      }

      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice("No active file found.");
        return;
      }

      const filePath = activeFile.path;
      const fileContent = await this.app.vault.read(activeFile);

      const blockRegex = /%% Todoist Start(?: \[(.+?)\])? %%([\s\S]*?)%% Todoist End(?: \[\1\])? %%/g;
      let updatedContent = fileContent;
      let matchCount = 0;
      let totalTasks = 0;
      let hasShownFetchingNotice = false;
      let match;

      while ((match = blockRegex.exec(fileContent)) !== null) {
        matchCount++;

        // Show Fetching notice only once
        if (!hasShownFetchingNotice) {
          new Notice("Fetching Todoist tasks...");
          hasShownFetchingNotice = true;
        }

        const [fullMatch, filterString] = match;

        // Parse filter
        const filter = filterString ? filterString.split("|").map((f) => f.trim()) : [];

        // Fetch tasks
        const taskData = await fetchTasks(this.settings.apiKey, filter);
        const taskCount = Object.values(taskData.tasks).flat().length;
        totalTasks += taskCount;

        if (taskCount > 0) {
          new Notice(`${taskCount} tasks found for [${filterString || "All"}].`);
        } else {
          new Notice(`No tasks found for [${filterString || "All"}].`);
        }

        const formattedTasks = formatTasksWithProjects(taskData);

        // Replace the matched block with the updated tasks
        updatedContent = updatedContent.replace(
          fullMatch,
          `%% Todoist Start${filterString ? ` [${filterString}]` : ""} %%\n${formattedTasks}\n\n%% Todoist End${filterString ? ` [${filterString}]` : ""} %%`
        );
      }

      if (matchCount === 0) {
        new Notice("Marker not found.");
      } else {
        await this.app.vault.modify(activeFile, updatedContent);
        if (totalTasks > 0) {
          new Notice(`Tasks added.`);
        }
      }
    });
  }
};

// Setting page
class TodoistSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();

    const descEl = document.createElement('div');
    descEl.appendChild(document.createTextNode('Enter your Todoist API token. '));

    const link = document.createElement('a');
    link.href = 'https://app.todoist.com/app/settings/integrations/developer';
    link.textContent = 'Get it from here';
    link.target = '_blank';
    descEl.appendChild(link);

    new Setting(containerEl)
      .setName("API token")
      .setDesc(descEl)
      .addText((text) =>
        text
          .setPlaceholder("Paste your API token here")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveData(this.plugin.settings);
          })
      );
  }
}