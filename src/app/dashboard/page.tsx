import { Tabs, TabsContent, TabsList, TabsTrigger } from "src/components/ui/tabs";
import { permanentRedirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { Role } from "~/server/db/types";
import { api } from "~/trpc/server";
import RecruitmentCycleCombobox from "./recruitment-cycle-combobox";
import QuestionCard from "./question-card";
import PhaseCard from "./phase-card";
import ViewApplications from "./view-applications";

/**
 * The dashboard page meant for members and admins to manage applications and 
 * all things TCG
 */
export default async function Dashboard() {
    // TODO: Replace permanentRedirect with redirect 
    // https://github.com/vercel/next.js/issues/59800
    const session = await getServerAuthSession();

    if (!session) {
        permanentRedirect("/api/auth/signin");
    } else if (session.user.role === Role.APPLICANT) {
        permanentRedirect("/");
    }

    const cycles = await api.recruitmentCycle.getAll.query();

    return (
        <main className="flex flex-col px-12 py-8">
            <h1 className="text-3xl">Dashboard</h1>
            <RecruitmentCycleCombobox
                className="mt-6 mb-2"
                createOption={session.user.role === Role.ADMIN}
                recruitmentCycles={cycles}
                selectedCycle={cycles?.[0]?.id ?? ""}
            ></RecruitmentCycleCombobox>
            <Tabs defaultValue="applications" className="h-full">
                <TabsList>
                    <TabsTrigger value="applications">Applications</TabsTrigger>
                    {session.user.role === Role.ADMIN &&
                        <TabsTrigger value="manage">Management</TabsTrigger>
                    }
                </TabsList>
                <TabsContent value="applications" className="flex flex-col">
                    <ViewApplications></ViewApplications>
                </TabsContent>
                {session.user.role === Role.ADMIN &&
                    <TabsContent value="manage">
                        <div className="flex gap-x-8">
                            <QuestionCard></QuestionCard>
                            <PhaseCard></PhaseCard>
                        </div>
                    </TabsContent>
                }
            </Tabs>
        </main>
    );
}
