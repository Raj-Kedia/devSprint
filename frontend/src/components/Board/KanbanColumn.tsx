import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  accentColor: string;
  onAddTask: (status: TaskStatus) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  title,
  tasks,
  accentColor,
  onAddTask,
}) => {
  return (
    <div className="flex flex-col rounded-xl bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-2.5 min-w-[260px] sm:min-w-[280px] flex-1 transition-colors">
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2 px-1 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accentColor}`}></span>
          <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{title}</h3>
          <span className="text-[11px] text-zinc-500 font-mono">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(status)}
          className="p-1 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
          title={`Add task`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[450px] rounded-lg transition-colors p-0.5 ${
              snapshot.isDraggingOver ? 'bg-zinc-200/40 dark:bg-zinc-800/30' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
