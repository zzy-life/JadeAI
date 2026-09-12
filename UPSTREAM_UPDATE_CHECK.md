# 主仓库更新检测流程

本文用于检查当前仓库与主仓库之间的提交及文件差异。检测操作只读取和更新远程引用，不会合并代码，也不会修改工作区文件。

## 仓库关系

- 当前仓库（`origin`）：`https://github.com/zzy-life/JadeAI.git`
- 主仓库（`upstream`）：`https://github.com/LingyiChen-AI/JadeAI.git`
- 默认分支：`main`

## 一、首次配置主仓库远程地址

先检查现有远程仓库：

```bash
git remote -v
```

如果没有 `upstream`，执行：

```bash
git remote add upstream https://github.com/LingyiChen-AI/JadeAI.git
```

再次确认：

```bash
git remote -v
```

预期包含：

```text
origin    https://github.com/zzy-life/JadeAI.git (fetch)
origin    https://github.com/zzy-life/JadeAI.git (push)
upstream  https://github.com/LingyiChen-AI/JadeAI.git (fetch)
upstream  https://github.com/LingyiChen-AI/JadeAI.git (push)
```

> `upstream` 的 push 地址虽然会显示，但通常不要向主仓库推送。

## 二、每次检测前获取最新远程信息

```bash
git fetch origin
git fetch upstream
```

也可以一次获取全部远程仓库：

```bash
git fetch --all --prune
```

说明：

- `fetch` 只更新远程分支引用，不会把代码合并到当前分支。
- `--prune` 会清理远程已删除分支对应的本地远程引用，不会删除本地开发分支。

## 三、查看双方领先的提交数量

```bash
git rev-list --left-right --count main...upstream/main
```

输出示例：

```text
16  2
```

含义：

- 左侧数字：本地 `main` 独有的提交数量。
- 右侧数字：主仓库 `upstream/main` 独有的提交数量。
- 右侧大于 `0`，表示主仓库有尚未同步的更新。

如果要比较自己 GitHub 上的分支和主仓库，可以使用：

```bash
git rev-list --left-right --count origin/main...upstream/main
```

## 四、只查看主仓库新增的提交

```bash
git log --oneline --decorate main..upstream/main
```

查看日期和作者：

```bash
git log --date=short --format="%h  %ad  %an  %s" main..upstream/main
```

这里的范围含义是：存在于 `upstream/main`、但不存在于本地 `main` 的提交。

如果需要以远程 `origin/main` 为基准：

```bash
git log --date=short --format="%h  %ad  %an  %s" origin/main..upstream/main
```

## 五、查看主仓库更新涉及哪些文件

查看文件状态及增删行数：

```bash
git diff --stat main...upstream/main
```

只列出文件名和变更状态：

```bash
git diff --name-status main...upstream/main
```

状态常见含义：

- `A`：新增文件
- `M`：修改文件
- `D`：删除文件
- `R`：重命名文件

查看完整代码差异：

```bash
git diff main...upstream/main
```

> 三点范围 `main...upstream/main` 从双方共同基点开始，只展示主仓库一侧的改动，适合判断“主仓库更新了什么”。

## 六、查看某个上游提交的具体

查看提交概要和文件统计：

```bash
git show --stat <提交SHA>
```

查看完整改动：

```bash
git show <提交SHA>
```

示例：

```bash
git show --stat aca6fbb
```

## 七、推荐的日常检测命令

依次执行：

```bash
git fetch --all --prune
git rev-list --left-right --count main...upstream/main
git log --date=short --format="%h  %ad  %an  %s" main..upstream/main
git diff --stat main...upstream/main
git diff --name-status main...upstream/main
```

如果第二条命令右侧为 `0`，说明当前本地 `main` 已包含主仓库的全部提交；后续日志和差异命令通常没有输出。

## 八、查看分叉点

```bash
git merge-base main upstream/main
```

查看分叉关系图：

```bash
git log --graph --oneline --decorate --all --max-count=50
```

## 九、检测与同步的区别

本文命令用于检测，不会自动同步主仓库代码。

以下命令会改变分支或工作区，检测时不要直接执行：

```bash
git merge upstream/main
git rebase upstream/main
git reset --hard upstream/main
git pull upstream main
```

需要同步时，应先检查：

```bash
git status
git log --oneline main..upstream/main
git diff main...upstream/main
```

确认本地改动、冲突风险和同步方式后，再决定使用 `merge`、`rebase` 或挑选提交。不要使用 `reset --hard` 处理分叉，否则可能丢失自己的提交和未提交改动。

## 十、本次检测结果（2026-09-12）

本次检测时：

- 双方共同基点：`ef3e3af3bc84737050380a4c85fc84d63914a471`
- 当前仓库独有：16 个提交
- 主仓库独有：2 个提交
- 主仓库最新提交：`aca6fbbb0beaba3b4615cce8a7e8cb52e387dc64`

主仓库独有提交：

```text
fe75a50  暂存
aca6fbb  chore: 忽略 .superpowers 目录下所有内容
```

涉及文件：

```text
M  .gitignore
D  .superpowers/sdd/2026-08-24-recruit-interview-blueprint/final-fixes-report.md
```
