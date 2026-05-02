interface LearningPanelProps {
  status?: string;
  loading: boolean;
  onConfirm: () => void;
}

export function LearningPanel({ status, loading, onConfirm }: LearningPanelProps) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>学习确认</h3>
        <span>{status === 'waiting_learning_confirmation' ? '待确认' : '空闲'}</span>
      </div>
      <p className="panel-description">当会话产生 memory、rule、skill 候选时，在这里统一确认沉淀。</p>
      <button
        className="panel-button wide"
        disabled={loading || status !== 'waiting_learning_confirmation'}
        onClick={onConfirm}
      >
        确认学习沉淀
      </button>
    </div>
  );
}
