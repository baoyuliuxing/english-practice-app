interface Props {
  onStart: () => void;
}

/**
 * 欢迎页
 */
export function WelcomeScreen({ onStart }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center text-4xl mb-6 shadow-xl shadow-brand-500/30">
        ✍️
      </div>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">英语写作练习</h1>
      <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed">
        AI 驱动的英文写作陪练<br />
        纠错 + 对话 + 日记，一步到位
      </p>

      {/* 核心流程 */}
      <div className="w-full max-w-sm space-y-3 mb-8">
        <FeatureItem
          icon="💬"
          title="输入即得纠正 + 陪练"
          desc="中英混合输入，AI 同时纠正语法并接话引导你继续练习"
        />
        <FeatureItem
          icon="📚"
          title="错词自动收集"
          desc="每次纠正后自动提取错误词汇到单词本，支持遮盖背诵"
        />
        <FeatureItem
          icon="📝"
          title="结束即生成日记"
          desc="点击「结束」汇总所有练习句子，AI 生成结构化英文日记"
        />
      </div>

      <button
        onClick={onStart}
        className="w-full max-w-sm py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-base transition-colors active:scale-95 shadow-lg shadow-brand-500/30"
      >
        开始练习
      </button>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
      <span className="text-xl shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
