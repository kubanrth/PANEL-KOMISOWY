export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-2">
      <div className="h-1 w-32 rounded-full bg-blue/30 overflow-hidden">
        <div className="h-full bg-blue origin-left animate-[loading_1.2s_ease-in-out_infinite]" style={{ width: "60%" }} />
      </div>
      <style>{`
        @keyframes loading {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(50%); }
          100% { transform: translateX(150%); }
        }
      `}</style>
    </div>
  );
}
