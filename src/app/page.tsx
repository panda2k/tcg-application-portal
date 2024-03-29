import { getServerAuthSession } from "~/server/auth";
import AuthButton from "./auth-button";
import Link from "next/link";
import { Role } from "~/server/db/types";
import { api } from "~/trpc/server";
import { Instagram } from "lucide-react";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import type { Application, RecruitmentCycle } from "./types";
import RecruitmentCycleText from "./recruitment-cycle-text";

/**
 * The action a user can take depending on their role and whether there is an active cycle
 * Member or Admin -> Dashboard
 * Applicant -> 
 *  Active Recruitment Cycle -> Start / Continue Application
 *  No active cycle -> Follow on Instagram
 *
 * @param role the logged in user's role
 * @param application the logged in user's application for the active cycle
 * @param activeCycle the current active recruitment cycle
 */
function ActionButton({
    role,
    application,
    activeCycle
}: {
    role: Role | undefined,
    application: Application | undefined,
    activeCycle: RecruitmentCycle | undefined
}) {
    if (role === Role.APPLICANT) {
        if (!activeCycle) {
            return (
                <Button>
                    <Link href="https://www.instagram.com/ucsdtcg/" className="flex items-center gap-x-2">
                        <Instagram />
                        @ucsdtcg
                    </Link>
                </Button>
            );
        }

        return (
            <Button>
                <Link href="/apply">
                    {!application
                        ? "Start your application"
                        : application.submitted
                            ? "View your submitted application"
                            : "Continue your application"
                    }
                </Link>
            </Button>
        );
    } else if (role === Role.ADMIN || role === Role.MEMBER) {
        return (
            <Button>
                <Link href="/dashboard">
                    Dashboard
                </Link>
            </Button>
        );
    }
}

/**
 * The home page for the application portal
 */
export default async function Home() {
    const [session, activeCycle] = await Promise.all([
        getServerAuthSession(),
        api.recruitmentCycle.getActive.query()
    ]);
    const application = (session?.user.role === Role.APPLICANT && activeCycle) ? await api.application.getUserApplicationByCycleId.query(activeCycle.id) : undefined;

    return (
        <div className="min-h-screen flex flex-col">
            <div className="pl-4 pt-2">
                <Image alt="TCG Logo" height={48} width={136} src="/logo.png" />
            </div>
            <main className="flex flex-col grow items-center justify-center text-primary-background">
                <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
                    <div className="flex flex-col gap-y-4">
                        <h1 className="text-5xl text-center font-extrabold tracking-tight sm:text-[5rem]">
                            Applicant Portal
                        </h1>
                    </div>
                    <div className="flex flex-col items-center gap-y-3">
                        <p className="text-center text-2xl">
                            {session && <span>Welcome back {session.user?.name?.split(" ")[0]}</span>}
                        </p>
                        {session?.user.role === Role.APPLICANT &&
                            <RecruitmentCycleText activeCycle={activeCycle} />
                        }
                        <div className="flex gap-x-3">
                            <ActionButton
                                activeCycle={activeCycle}
                                application={application}
                                role={session?.user.role}
                            ></ActionButton>
                            <AuthButton loggedIn={session !== null}></AuthButton>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

