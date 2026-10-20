---
name: excalidraw-diagram
description: 画技术图：流程图、架构图、时序图、数据流、状态机、调用链等。输出 PNG 和可编辑的 .excalidraw 文件，风格为干净的非手绘线条加语义配色，本地渲染并自动检查重叠和穿线。Use when the user asks to draw, visualize, or diagram a flowchart, architecture, sequence diagram, workflow, data flow, state machine, or system design (画图、流程图、架构图、时序图、示意图、可视化).
---

# 技术图（Excalidraw，非手绘风格）

你写一个骨架文件 `<name>.skel.json`，渲染器生成：
- `<name>.png`：交付给用户的图
- `<name>.excalidraw`：可拖进 excalidraw.com 或用 VS Code 的 Excalidraw 插件打开，手动微调

参考文件（动手前先读）：
- `references/color-palette.md`：配色，唯一来源
- `references/element-templates.md`：骨架格式和各类元素模板
- `references/example-flowchart.skel.json`：标准样例，新图照它的写法

## 风格（固定，不要自由发挥）

| 项 | 值 |
|---|---|
| 线条 | `roughness: 0`；形状和箭头 `strokeWidth: 1.5`，分组框 `1` |
| 字体 | `fontFamily: 2`（Helvetica，中文自动用苹方）；节点 18、连线标签 16、分组标题 20、图标题 28 |
| 箭头 | `endArrowhead: "triangle"`；只用横平竖直的折线 |
| 矩形 | `roundness: {"type": 3}`，`fillStyle: "solid"` |
| 颜色 | 只用 color-palette.md 里的颜色。节点按语义上色，大部分白底黑框；有多个领域或参与方时，用"领域身份色"区分它们，不要画成全黑灰 |
| 禁止 | 手绘风、渐变、阴影、半透明、emoji、装饰性图标、深色背景；图例和解释画法的说明文字（用户要求时才加） |

## 画法约定

**形状含义**：步骤、服务、组件用 rectangle；判断用 diamond；入口和外部触发用 ellipse；中间件和存储（MQ、DB、Cache）用 rectangle 配 infra 色；系统、服务、分层的边界用虚线分组框，标题写在框内左上角。

**布局**：
- 跨服务、跨系统的流向从左到右；同一服务内部从上到下。
- 主路径走直线。失败和异常分支朝同一个方向分出（一般向下），用红色。
- 回环（如重试）用红色虚线，沿该列外侧绕回。
- 一对多（fan-out）先画一条竖直"总线"，再水平分叉到各目标。
- 坐标取 10 的倍数。同一列节点同宽、同 x。行距 ≥ 50，列距 ≥ 60。
- 尺寸：单行节点 180×60，两行 180×64，判断 190×100。分组框内边距 ≥ 30，顶部留 50 给标题。
- 带标签的连线段长度 ≥ 70，给标签留位置。

**文字**：
- 节点标签最多 2 行，每行不超过 10 个汉字，换行用 `\n`。连线标签不超过 4 个字。
- 用真实名称：服务名、表名、topic、接口名。内容来自代码时先读代码，不要编造。
- 中文字宽估算：每个汉字约 1 × fontSize，英文和数字约 0.6 × fontSize。节点宽度 ≥ 最长一行的宽度 + 40。

## 工作流程

1. **理清内容**：有哪些节点、分支、服务边界，主路径是哪条。
2. **规划网格**：服务为列、步骤为行，先把每个节点的 x、y、宽、高算好，再写 JSON。
3. **写骨架**：直接手写 `<name>.skel.json`，不要写生成脚本。大图按分组分几次写。文件默认放在当前项目的 `docs/diagrams/`（目录不存在就放当前目录），用户指定了位置就按用户的。
4. **渲染**：
   ```bash
   bash "${CLAUDE_SKILL_DIR}/references/render.sh" <path>/<name>.skel.json
   ```
5. **检查和修改**：先修掉输出里 `LINT:` 列出的所有问题，再用 Read 查看 PNG，按下面的清单逐条检查。改完骨架重新渲染，通常 2 到 3 轮。
6. **交付**：告诉用户 PNG 和 `.excalidraw` 的路径，并说明 `.excalidraw` 可以在 excalidraw.com 里打开微调。

**用户手动改过 `.excalidraw` 时**：渲染器会拒绝用骨架覆盖它。这时直接修改 `.excalidraw`（完整格式，见 element-templates.md 末尾），再渲染这个文件本身。除非用户明确要求放弃手动修改，否则不要加 `--force`。

## 检查清单（看 PNG 时逐条过）

- 文字没有被裁切或溢出，节点没有重叠
- 箭头不穿过节点，落点和方向正确
- 连线标签紧挨着它所属的连线，没有压到别的元素
- 同类元素间距一致，同列对齐
- 颜色只用来表达语义（判断、失败、成功、中间件、入口），没有装饰性用色
- 整体均衡，没有大片空白或拥挤区域
- PNG 原尺寸下文字清晰可读

## 其他图类型

- **架构图**：分组框表示系统、服务或分层（接入层、服务层、数据层），框内节点是组件；不同团队或领域的分组框，边框和标题用领域身份色；存储和中间件用 infra 色，外部系统用 external 色；连线标签写协议或数据（如 `gRPC`、`binlog`）。
- **时序图**：参与方框在顶部排成一行，用领域身份色填充（宽 240 到 260，高 60，中心间距按最长消息标签定，一般 440）。生命线是从框底向下的浅色虚线 `line`。消息是水平箭头，颜色取发起方：实线加实心箭头表示调用，虚线表示返回或确认，实线加空心箭头（`endArrowhead: "arrow"`）表示异步通知。消息标签压在其他参与方的生命线上时，把那条生命线在标签处断开。阶段、`alt`、`loop` 用 frame 虚线框，左上角写标题。自调用用 3 段折线绕回自身。模板见 element-templates.md。
- **状态机**：状态用圆角矩形；初始状态用 20×20 的实心圆；状态转换用箭头，标签写事件名。

## 环境

- 渲染使用本机 Google Chrome（也可以用环境变量 `CHROME_PATH` 指定浏览器），并且需要能访问 esm.sh 来加载 Excalidraw。
- `render.sh` 首次运行时会自动 `npm install` 唯一的依赖 playwright-core，需要 Node.js 18 以上。
- 中文用系统字体：macOS 自带苹方；Linux 需要装 Noto Sans CJK（如 `fonts-noto-cjk`），否则中文显示为方框。
- 渲染失败时，运行 `bash "${CLAUDE_SKILL_DIR}/../../install.sh" --check` 查看缺什么。
