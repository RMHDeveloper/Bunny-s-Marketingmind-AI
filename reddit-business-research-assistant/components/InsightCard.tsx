
import React from 'react';
import { cleanText } from '../App';

interface InsightCardProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
}

const InsightCard: React.FC<InsightCardProps> = ({ title, items, icon }) => {
  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 h-full transition-all border border-gray-100 shadow-sm hover:shadow-md flex flex-col group print:border-gray-200">
      <div className="flex items-center mb-6 border-b border-gray-50 pb-4 print:border-gray-200">
        <div className="mr-3 p-2.5 rounded-xl bg-zinc-50 text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-black transition-colors">
          {title}
        </h3>
      </div>
      
      {items && items.length > 0 ? (
        <ul className="space-y-5 flex-grow">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-[9px] flex-shrink-0 group-hover:bg-black transition-colors" />
              <p className="text-zinc-700 text-[15px] md:text-base leading-7 font-normal">
                {cleanText(item)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center flex-grow opacity-30">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Scanning for insights...</p>
        </div>
      )}
    </div>
  );
};

export default InsightCard;
