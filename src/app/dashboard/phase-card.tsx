"use client"

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { GripVertical, Pencil, Trash2, X } from "lucide-react";
import { useAtom } from "jotai";
import { recruitmentCyclePhasesAtom, selectedRecruitmentCycleAtom } from "./atoms";
import { api } from "~/trpc/react";
import CreatePhase from "./create-phase";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function PhaseCard() {
    const [recruitmentCycle] = useAtom(selectedRecruitmentCycleAtom);
    const [editing, setEditing] = useState<boolean>(false);
    const [phases, setPhases] = useAtom(recruitmentCyclePhasesAtom);
    const getPhases = api.recruitmentCyclePhase.getByCycleId.useQuery(recruitmentCycle, { enabled: false });
    const reorderPhases = api.recruitmentCyclePhase.reorder.useMutation();
    const deletePhaseMutation = api.recruitmentCyclePhase.delete.useMutation();
    const sensors = useSensors(useSensor(PointerSensor));

    const fetchPhases = async () => {
        if (recruitmentCycle) {
            const phases = (await getPhases.refetch()).data || [];
            setPhases(phases);
        }
    };

    const deletePhase = async(id: string) => {
        setPhases(phases.filter(p => p.id !== id));
        await deletePhaseMutation.mutateAsync(id);
    }

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (over && active.id !== over.id) {
            const activeIdx = phases.findIndex(q => q.id === active.id);
            const overIdx = phases.findIndex(q => q.id === over.id);
            let newQuestions = [...phases]
            // if next to eachother, swap order
            // else insert at hover over position and move everything else back
            if (Math.abs(activeIdx - overIdx) === 1) {
                const tmp = newQuestions[activeIdx];
                newQuestions[activeIdx] = newQuestions[overIdx] as typeof phases[number];
                newQuestions[overIdx] = tmp as typeof phases[number];
            } else {
                newQuestions = newQuestions.filter(q => q.id !== active.id);
                newQuestions.splice(
                    overIdx, 
                    0,
                    phases[activeIdx] as typeof phases[number]
                );
            }
            setPhases(newQuestions.map((q, idx) => {
                q.order = idx;
                return q;
            }));
            reorderPhases.mutateAsync(newQuestions.map(q => q.id ?? ""));
        }
    };

    useEffect(() => {
        fetchPhases();
    }, [recruitmentCycle]);

    function SortablePhase({ p }: { p: typeof phases[number] }) {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: p.id ?? "", disabled: !editing });

        const style: React.CSSProperties = {
            transition,
            transform: CSS.Transform.toString(transform ? {
                ...transform,
                scaleX: 1,
                scaleY: 1
            } : transform),
            ...(isDragging ? { border: "none" } : {}),
        };
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="border-zinc-700 pt-2 flex flex-row items-center justify-between"
            >
                <div className="flex flex-row items-center">
                    {editing && (
                        <Button variant="ghost" className="p-0 mr-3 ml-2 h-6 w-6" onClick={() => deletePhase(p.id)}>
                            <Trash2 />
                        </Button>
                    )}
                    <CreatePhase asChild existingPhase={p} disabled={!editing}>
                        <div className={"flex flex-col " + (editing && "cursor-pointer")}>
                            <h1 className="flex text-md font-semibold">
                                {p.displayName}
                            </h1>
                        </div>
                    </CreatePhase>
                </div>
                {editing && (
                    <div className="h-6 w-6 ml-3">
                        <GripVertical
                            {...attributes}
                            {...listeners}
                        />
                    </div>
                )}
            </div>
        )
    }

    return (
        <Card className="w-1/3 flex flex-col">
            <CardHeader className="pb-1">
                <CardTitle className="flex justify-between items-center">
                    Recruitment Cycle Phases
                    <Button variant="ghost" onClick={() => setEditing(!editing)}>
                        {editing ? <X /> : <Pencil />}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-grow gap-y-2 divide-y">
                {!recruitmentCycle && "Select a recruitment cycle first"}
                {recruitmentCycle && !phases.length && "No phases have been created"}
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <SortableContext 
                        strategy={verticalListSortingStrategy}
                        items={phases.map(p => p.id)}
                    >
                        {phases.map(p => (
                            <SortablePhase p={p} key={p.id}></SortablePhase>
                        ))}
                    </SortableContext>
                </DndContext>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-y-4">
                <CreatePhase></CreatePhase>
            </CardFooter>
        </Card>
    )
}