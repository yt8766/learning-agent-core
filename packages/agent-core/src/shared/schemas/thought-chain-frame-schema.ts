import { z } from 'zod/v4';

export const ThoughtChainFrameSchema = z.object({
  key: z.string().describe('ThoughtChain 节点唯一标识'),
  title: z.string().describe('ThoughtChain 节点标题'),
  description: z.string().optional().describe('ThoughtChain 节点摘要'),
  content: z.string().optional().describe('ThoughtChain 节点补充内容'),
  footer: z.string().optional().describe('ThoughtChain 节点脚注'),
  status: z.enum(['loading', 'success', 'error', 'abort']).optional().describe('节点状态'),
  collapsible: z.boolean().optional().describe('节点内容是否可折叠'),
  blink: z.boolean().optional().describe('节点是否需要高亮闪烁')
});

export type ThoughtChainFrame = z.infer<typeof ThoughtChainFrameSchema>;
