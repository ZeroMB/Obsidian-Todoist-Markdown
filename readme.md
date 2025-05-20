### Features

| Format                                                                             | Usecase                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `%% Todoist Start %%`<br>`%% Todoist End %%`                                       | Start block and End block.                           |
| `%% Todoist Start [today \| overdue] %%`<br>`%% Todoist End [today \| overdue] %%` | Add single or multiple filters.                      |
| `\|`<br>`&`<br>`!`                                                                 | Operators:<br>Add (`\|`), Subtract (`&`), Not (`!`). |
| `%% Todoist Start %%`<br>`%% Todoist End %%`<br>or with `[all]` filter.            | Fetch all active tasks.                              |
| `[today]`                                                                          | Fetch only today's tasks.                            |
| `[overdue]`                                                                        | Fetch overdue tasks.                                 |
| `[tomorrow]`                                                                       | Fetch tomorrow's tasks.                              |
| `[#Project-Name]`                                                                  | Fetch projects tasks with there name.                |
| `[p1]`, `[p2]`, `[p3]`, `[p4]`                                                     | Filter with priority `[today & p1]`.                 |
| `[!subtask]`                                                                       | Do not fectch sub tasks.                             |
| `[completed]`                                                                      | Fetch completed tasks.                               |


### Todo

- [ ] `!subtask` filter not working with `&` filter.
- [ ] `completed` filter not working with `&` filter.
- [ ] Add `yesterday`.
- [ ] Add more than 2 filters.
- [ ] Add date filtering (`31-12-2024`) with operators.
	`%% Todoist Start [31-12-2025] %%`
	`%% Todoist End [15-01-2026] %%`
- [ ] Sync with Todoist.
- [ ] Setting panel:
	- [ ] Change date format.
	- [ ] Sync on/off.