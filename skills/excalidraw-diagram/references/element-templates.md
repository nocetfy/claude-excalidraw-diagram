# 骨架格式（`.skel.json`）

文件内容是一个 JSON 数组，每个元素一个对象。渲染器用 Excalidraw 官方的 `convertToExcalidrawElements` 补全其余字段：
- 用真实字体测量文字宽度，把文字居中放进形状；
- 连线标签自动放在折线的中点；
- 文字放不下时会自动加高形状，LINT 会以 `resized` 报出来，这时应在骨架里把形状改大。

所以**不要**写 seed、version、boundElements、containerId 这类字段，也不要给形状内的文字单独算坐标。

## 通用规则

- `id`：唯一且有含义，例如 `order_tx`。连线以 `e_` 开头，例如 `e_tx_fail`。
- `x`、`y` 是左上角坐标，取 10 的倍数。
- 颜色、字号一律按 color-palette.md。
- 数组顺序就是绘制顺序：先放分组框，再放节点，最后放连线。

## 节点

普通步骤：
```json
{"type": "rectangle", "id": "tx", "x": 360, "y": 430, "width": 180, "height": 64,
 "backgroundColor": "#ffffff", "strokeColor": "#1e1e1e", "fillStyle": "solid", "strokeWidth": 1.5, "roughness": 0,
 "roundness": {"type": 3},
 "label": {"text": "更新订单状态\nMySQL 事务", "fontSize": 18, "fontFamily": 2, "strokeColor": "#1e1e1e"}}
```

判断（菱形不加 `roundness`）：
```json
{"type": "diamond", "id": "tx_ok", "x": 355, "y": 540, "width": 190, "height": 100,
 "backgroundColor": "#fff3bf", "strokeColor": "#e8590c", "fillStyle": "solid", "strokeWidth": 1.5, "roughness": 0,
 "label": {"text": "写入成功?", "fontSize": 18, "fontFamily": 2, "strokeColor": "#1e1e1e"}}
```

入口或外部触发：`"type": "ellipse"`，尺寸 200×64，配 infra 色，其余字段同上。

中间件或存储：rectangle 配 infra 色，标签写实例或 topic，例如 `"Kafka\norder.paid"`。

## 分组框和标题

```json
{"type": "rectangle", "id": "grp_order", "x": 320, "y": 110, "width": 500, "height": 780,
 "backgroundColor": "transparent", "strokeColor": "#868e96", "strokeStyle": "dashed", "strokeWidth": 1, "roughness": 0,
 "roundness": {"type": 3}, "customData": {"role": "group"}},
{"type": "text", "id": "grp_order_title", "x": 336, "y": 122, "text": "订单服务", "fontSize": 20, "fontFamily": 2, "strokeColor": "#495057"}
```

`customData.role` 为 `"group"` 或 `"frame"` 的元素不会被当成节点参与重叠检查。

## 连线

`x`、`y` 是起点的绝对坐标；`points` 是相对起点的偏移，第一个点固定为 `[0, 0]`。每一段都必须是水平或竖直的。`start`、`end` 用来绑定节点，绑定后在 Excalidraw 里拖动节点时箭头会跟着走。

锚点（形状的外接矩形为 x、y、w、h；菱形和椭圆的锚点就是它们的顶点）：
- 上：`(x + w/2, y)`
- 下：`(x + w/2, y + h)`
- 左：`(x, y + h/2)`
- 右：`(x + w, y + h/2)`

直线，带标签：
```json
{"type": "arrow", "id": "e_tx_fail", "x": 450, "y": 640, "points": [[0, 0], [0, 50]],
 "strokeColor": "#e03131", "strokeWidth": 1.5, "roughness": 0, "endArrowhead": "triangle",
 "start": {"id": "tx_ok"}, "end": {"id": "retry"},
 "label": {"text": "失败", "fontSize": 16, "fontFamily": 2, "strokeColor": "#495057"}}
```

折线：在 `points` 中加拐点。下面是从判断右顶点出发，先向右，再向上，再向右进入下一个节点：
```json
"x": 225, "y": 325, "points": [[0, 0], [65, 0], [65, -123], [135, -123]]
```

回环（虚线，沿该列外侧绕回）：加 `"strokeStyle": "dashed"`，路径从源节点左边出发、向左、向上、再向右进入目标节点左边。

一对多（总线）：每条连线都走 起点 → 总线 x → 目标的 y → 目标。各条线在总线上重合，看起来就是一条总线。

## 自由文字

```json
{"type": "text", "id": "note_1", "x": 40, "y": 900, "text": "注：outbox 由定时任务补偿投递", "fontSize": 16, "fontFamily": 2, "strokeColor": "#868e96"}
```

## 时序图元素

参与方：在顶部 `y = 0` 排一行，用领域身份色（见 color-palette.md）。
```json
{"type": "rectangle", "id": "p_trade", "x": 610, "y": 0, "width": 260, "height": 60,
 "backgroundColor": "#d0ebff", "strokeColor": "#1971c2", "fillStyle": "solid", "strokeWidth": 1.5, "roughness": 0,
 "roundness": {"type": 3},
 "label": {"text": "交易（编排方）", "fontSize": 20, "fontFamily": 2, "strokeColor": "#1e1e1e"}}
```

生命线：从参与方框底边中点往下画，用该领域的浅色。
```json
{"type": "line", "id": "life_trade", "x": 740, "y": 60, "points": [[0, 0], [0, 890]],
 "strokeColor": "#74c0fc", "strokeStyle": "dashed", "strokeWidth": 1, "roughness": 0}
```

消息：水平箭头，从一条生命线画到另一条，不绑定，颜色取发起方的描边色。返回消息加 `"strokeStyle": "dashed"`；异步通知用 `"endArrowhead": "arrow"`。消息之间的纵向间距 ≥ 60。
```json
{"type": "arrow", "id": "e_dispatch", "x": 740, "y": 330, "points": [[0, 0], [440, 0]],
 "strokeColor": "#1971c2", "strokeWidth": 1.5, "roughness": 0, "endArrowhead": "triangle",
 "label": {"text": "派单，附第 1 版副本（原样转交）", "fontSize": 16, "fontFamily": 2, "strokeColor": "#343a40"}}
```

消息标签压在中间某个参与方的生命线上时（跨两列的长消息），把那条生命线拆成两段，在标签上下各留约 16 的空隙。

自调用：用 3 段折线 `[[0, 0], [40, 0], [40, 30], [0, 30]]`，不带 label，在右侧另放一个自由文字作说明。

alt 和 loop 框：一个 frame 虚线框加左上角的说明文字；分支之间用一条虚线 `line` 分隔。
```json
{"type": "rectangle", "id": "frame_alt", "x": 180, "y": 200, "width": 700, "height": 320,
 "backgroundColor": "transparent", "strokeColor": "#868e96", "strokeStyle": "dashed", "strokeWidth": 1, "roughness": 0,
 "customData": {"role": "frame"}},
{"type": "text", "id": "frame_alt_title", "x": 190, "y": 206, "text": "alt 首次处理", "fontSize": 16, "fontFamily": 2, "strokeColor": "#495057"}
```

## 状态机元素

初始状态：一个 20×20 的实心圆。
```json
{"type": "ellipse", "id": "init", "x": 0, "y": 0, "width": 20, "height": 20,
 "backgroundColor": "#1e1e1e", "strokeColor": "#1e1e1e", "fillStyle": "solid", "strokeWidth": 1, "roughness": 0}
```

## 修改完整格式的 `.excalidraw`（仅当用户手动编辑过它时）

完整格式是 `{"type": "excalidraw", "elements": [...], ...}`，和骨架有几点不同：
- 形状内的文字是独立的 `text` 元素，用 `containerId` 指向所属形状。
- 箭头用 `startBinding` 和 `endBinding` 记录绑定关系。

移动一个形状时，它的文字元素也要移动相同的距离，相连箭头的 `x`、`y`、`points` 端点也要同步调整。只改必要的字段，保留用户的其他修改。改完后渲染这个 `.excalidraw` 文件本身。
