# localhost:8317 Login Behaviors

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-gateway` 登录页视觉还原参考
最后核对：2026-05-10

## Interaction Sweep

- **Scroll**：登录页为单屏布局，没有滚动驱动状态。
- **Click**：显示/隐藏管理密钥、记住密码和登录按钮是当前保留交互。
- **Responsive**：桌面为左右 50/50 分栏；`<= 768px` 隐藏黑色品牌大字面板。

## Extracted Tokens

- Body foreground：`rgb(45, 42, 38)`
- Page background：`rgb(255, 255, 255)`
- Left brand panel：`rgb(0, 0, 0)`
- Muted text：`rgb(109, 103, 96)`
- Border：`rgb(229, 229, 229)`
- Card shadow：`rgba(0, 0, 0, 0.1) 0px 10px 18px -3px`
