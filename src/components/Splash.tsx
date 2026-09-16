import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export function Splash() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-blue-600 text-white p-6 relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center text-center"
      >
        <div className="bg-white/20 p-4 rounded-3xl mb-6 backdrop-blur-sm">
          <CheckCircle2 className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">Daily TASK AI</h1>
        <p className="text-blue-100 text-lg font-medium max-w-[250px]">
          Speak it. Schedule it. Get it done.
        </p>
      </motion.div>
      <div className="absolute bottom-10 left-0 right-0 flex justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
