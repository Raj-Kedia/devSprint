import React from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TaskStatus } from '../../types';
import { KanbanColumn } from './KanbanColumn';
import { SprintHeader } from './SprintHeader';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
  onOpenCreateSprint: () => void;
  onOpenCreateTaskWithStatus: (status?: TaskStatus) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  onOpenCreateSprint,
  onOpenCreateTaskWithStatus,
}) => {
  const { boardColumns, moveTaskOptimistic, isLoadingBoard, activeSprint } = useSprintStore();
  const { isAdmin } = useAuthStore();

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = Number(draggableId);
    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    moveTaskOptimistic(taskId, sourceStatus, destStatus, source.index, destination.index);
  };

  const columnsConfig: { status: TaskStatus; title: string; accentColor: string }[] = [
    { status: 'TODO', title: 'To Do', accentColor: 'bg-slate-400' },
    { status: 'IN_PROGRESS', title: 'In Progress', accentColor: 'bg-indigo-400' },
    { status: 'IN_REVIEW', title: 'In Review', accentColor: 'bg-violet-400' },
    { status: 'DONE', title: 'Done', accentColor: 'bg-emerald-400' },
  ];

  return (
    <div className="w-full">
      <SprintHeader
        onOpenCreateSprint={onOpenCreateSprint}
        onOpenCreateTask={() => onOpenCreateTaskWithStatus('TODO')}
      />

      {isLoadingBoard && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-sm text-slate-400 font-medium">Loading sprint board...</span>
        </div>
      )}

      {!isLoadingBoard && !activeSprint && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
          <h3 className="text-lg font-bold text-white mb-2">No Active Sprint</h3>
          <p className="text-sm text-slate-400 mb-6">
            {isAdmin
              ? 'Create your first sprint to start tracking tasks and generating AI standup reports.'
              : 'No sprint is currently in progress. Please wait for your team lead to initiate the sprint.'}
          </p>
          {isAdmin && (
            <button
              onClick={onOpenCreateSprint}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Create First Sprint
            </button>
          )}
        </div>
      )}

      {!isLoadingBoard && activeSprint && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start overflow-x-auto pb-6">
            {columnsConfig.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                title={col.title}
                accentColor={col.accentColor}
                tasks={boardColumns[col.status] || []}
                onAddTask={(status) => onOpenCreateTaskWithStatus(status)}
              />
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
};
