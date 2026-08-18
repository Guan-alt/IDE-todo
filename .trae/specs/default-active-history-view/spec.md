# 默认显示未完成待办 + 历史记录 Spec

## Why
当前默认显示全部待办（含已完成），用户希望打开应用时只看到未完成的待办，已完成的待办归类到"历史记录"中，减少视觉干扰。

## What Changes
- 默认 `filterCompleted` 从 `"all"` 改为 `"active"`
- FilterBar 的状态 Tab 调整为：进行中（默认选中）、全部、历史记录
- "历史记录"替代"已完成"Tab，点击后展示已完成待办列表
- App.vue 列表区域根据当前 filter 展示不同内容，空列表提示文案对应调整

## Impact
- Affected code: src/App.vue, src/components/FilterBar.vue
- Affected specs: 无

## ADDED Requirements

### Requirement: 默认显示未完成待办
系统 SHALL 在应用启动时默认筛选显示未完成的待办，已完成待办不在主列表中显示。

#### Scenario: 应用启动
- **WHEN** 用户打开应用
- **THEN** 列表只显示未完成的待办，筛选状态默认为"进行中"

#### Scenario: 完成待办
- **WHEN** 用户勾选完成一条待办
- **THEN** 该待办从当前列表中消失（移入历史记录），列表实时更新

### Requirement: 历史记录视图
系统 SHALL 在 FilterBar 中提供"历史记录"Tab，点击后展示已完成待办列表。

#### Scenario: 查看历史记录
- **WHEN** 用户点击"历史记录"Tab
- **THEN** 列表切换为显示所有已完成待办，按完成时间倒序排列

#### Scenario: 空历史记录
- **WHEN** 用户点击"历史记录"且没有已完成待办
- **THEN** 显示"暂无已完成待办"提示

## MODIFIED Requirements

### Requirement: FilterBar 状态 Tab
原 Tab 为：全部 / 进行中 / 已完成。改为：进行中（默认）/ 全部 / 历史记录。
- "进行中" 对应 `filterCompleted="active"`，为默认选中
- "全部" 对应 `filterCompleted="all"`
- "历史记录" 对应 `filterCompleted="done"`，展示已完成待办

### Requirement: 空列表提示
- 进行中无待办时提示"没有未完成的待办"
- 历史记录无待办时提示"暂无已完成待办"
- 全部无待办时提示"暂无待办事项"
