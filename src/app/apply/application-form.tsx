"use client";

import { Form } from "~/components/ui/form";
import type { Application, ApplicationQuestion as ApplicationQuestionType, ApplicationResponse, RecruitmentCycle } from "../types";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import { ApplicationQuestion } from "~/components/ui/application-question";
import { z } from "zod";
import { getValidator } from "~/lib/validate-question";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { applicationResponses } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";
import { api } from "~/trpc/react";
import { FieldType } from "~/server/db/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Loading from "../loading";

const insertResponseSchema = createInsertSchema(applicationResponses);
type ApplicationResponseInsert = z.infer<typeof insertResponseSchema>;
// Debounce interval for how often the application should save
const UPDATE_INTERVAL = 1000;

/**
 * The application form that displays a user's in-progress or submitted application
 *
 * @param questions the application questions
 * @param responses the user's responses to the application questions
 * @param application the user's application object
 * @param cycle the active recruitment cycle
 */
export function ApplicationForm({
    questions,
    responses,
    application,
    cycle,
}: {
    questions: ApplicationQuestionType[],
    responses: ApplicationResponse[],
    application: Application,
    cycle: RecruitmentCycle
}) {
    // the queue of files being uploaded in any type="file" inputs
    const [fileUploadQueue, setFileUploadQueue] = useState<ApplicationQuestionType["id"][]>([]);
    // if the application has been submitted, the form is view-only and displays
    // slightly differently
    const [submitted, setSubmitted] = useState<boolean>(application.submitted);
    // whether the application is currently being submitted
    // if the application is currently being submitted, the page will resemble 
    // the loading.tsx page so it can seamlessly transition into the confirmation page
    const [loading, setLoading] = useState<boolean>(false);

    const submitApplicationMutation = api.application.submit.useMutation();
    const router = useRouter();
    /**
     * Submits the user's application and redirects them to the confirmation page
     */
    const submitApplication = async () => {
        setSubmitted(true);
        setLoading(true);
        // wait for file upload queue to finish before attempting to submit application
        while (Object.keys(updateQueue.current).length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            await submitApplicationMutation.mutateAsync(application.id);
            router.push("/apply/confirmation");
        } catch (e) {
            // this error will normally occur when a new question was added in between 
            // the time they opened the page and when they submit.
            // TODO: better error handling, e.g. if question was added, refresh the page
            // to fetch the new question or redirect to different screen if they attempted
            // to submit past the deadline
            toast("An error occured while submitting your application", {
                description:
                    "Please refresh the page and try again in a few minutes. " +
                    "If you continue having issues, please email board.tcg@gmail.com"
            });
            setSubmitted(false);
            setLoading(false);
        }
    };

    const formSchema = z.object(Object.fromEntries(questions.map(q => {
        const validator = getValidator(q);
        if (q.type === FieldType.FILE_UPLOAD && responses.find(r => r.questionId === q.id)?.value) {
            return [q.id, validator.nullish()];
        };

        return [q.id, validator];
    })));

    const defaultValues = questions.reduce((accumulator, question) => {
        return {
            [question.id]: responses.find(r => r.questionId === question.id)?.value ?? "",
            ...accumulator
        };
    }, {});

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues
    });
    const formWatch: Record<string, string | File> = form.watch();
    const prevSavedForm = useRef(defaultValues);
    const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
    const updateQueue = useRef<Record<string, { value: string | File } & ApplicationResponseInsert>>({});
    const createOrUpdateResponseMutation = api.applicationResponse.createOrUpdate.useMutation();
    const getPresignedUploadMutation = api.applicationResponse.getS3UploadUrl.useMutation();

    /**
     * Triggers whenever a question response gets updated. 
     * Commits the new updates to the backend
     *
     * TODO: possibly replace this with react-query functionality altogether
     */
    useEffect(() => {
        /**
         * If a file input changed, upload the new file to s3
         */
        const uploadFile = async (questionId: string, applicationId: string, file: File, responseId: string | undefined) => {
            setFileUploadQueue([...fileUploadQueue, questionId]);
            const { url: presignedUrl, key: fileName } = await getPresignedUploadMutation.mutateAsync(file.name);
            await fetch(presignedUrl, { method: "PUT", body: file });
            await createOrUpdateResponseMutation.mutateAsync({
                questionId: questionId,
                applicationId: applicationId,
                value: fileName,
                ... (responseId ? { id: responseId } : {})
            });
            setFileUploadQueue(fileUploadQueue.filter(k => k !== questionId));
        };

        // put all the changed form fields into the upload queue (unless it is a file)
        // file uploads get handled outside the normal update queue
        for (const questionId of Object.keys(formWatch)) {
            if (formWatch[questionId] !== prevSavedForm.current[questionId as keyof typeof defaultValues]) {
                const response = responses.find(r => r.questionId === questionId);
                const question = questions.find(q => q.id === questionId);
                if (!question) throw new Error("Question not found");
                if (question.type === FieldType.FILE_UPLOAD) {
                    void uploadFile(questionId, application.id, formWatch[questionId] as File, response?.id);
                    continue;
                };

                updateQueue.current[questionId] = {
                    questionId: questionId,
                    applicationId: application.id,
                    value: formWatch[questionId] as string,
                    ... (response ? { id: response.id } : {})
                };
            }
        }

        // reset the timeout for updating responses
        clearTimeout(debounceTimer.current);
        // commit all the updates in the update queue
        debounceTimer.current = setTimeout(() => {
            void (() => {
                for (const key in updateQueue.current) {
                    const update = updateQueue.current[key]!;
                    delete updateQueue.current[key];
                    const question = questions.find(q => q.id === key);
                    if (!question) throw new Error("Question not found");
                    createOrUpdateResponseMutation.mutate(update);
                }
            })();
        }, UPDATE_INTERVAL);
        prevSavedForm.current = formWatch;
    }, [formWatch]);

    const formatDate = (d: Date): string => {
        return `${d.toLocaleDateString('en-us', { weekday: "long", month: "short", day: "numeric" })} ${d.toLocaleTimeString()}`;
    };

    return (
        <>
            {loading ?
                <Loading />
                :
                <div>
                    <div className="flex flex-col gap-y-2 mb-4">
                        <h1 className="text-3xl">Application</h1>
                        <h2 className="mb-2">
                            {submitted ?
                                "You've already submitted your application. Keep an eye on your email for any updates to your application." :
                                `This form autosaves! Feel free to leave and finish your application later. Once you are
                                ready to submit, click "Submit Application".`
                            }
                        </h2>
                        {!submitted && <h2>You have until {formatDate(cycle.endTime)} to submit your application.</h2>}
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitApplication)} className="space-y-8">
                            {questions.map(q => (
                                <ApplicationQuestion
                                    disabled={submitted}
                                    question={q}
                                    control={form.control}
                                    key={q.id}
                                ></ApplicationQuestion>
                            ))}
                            {!submitted &&
                                <div className="flex flex-col gap-y-2">
                                    {fileUploadQueue.length > 0 &&
                                        <p>Wait for files to finish uploading...</p>
                                    }
                                    <Button
                                        type="submit"
                                        disabled={fileUploadQueue.length > 0}
                                        className="w-fit"
                                    >Submit Application</Button>
                                </div>
                            }
                        </form>
                    </Form>
                </div>
            }
        </>
    );
}

