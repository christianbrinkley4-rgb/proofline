/** Short recall cues from occupational duties. These remain questions, not evidence. */
export function recallWording(statement: string): string | null {
  const pairs: Array<[RegExp, string]> = [
    [/^Greet customers entering establishments/i, "Greeted customers as they arrived"],
    [/^Operate computers programmed with accounting software to record/i, "Recorded accounting information using accounting software"],
    [/^Check figures, postings, and documents for correct entry/i, "Checked accounting entries for accuracy"],
    [/^Perform financial calculations/i, "Calculated financial amounts"],
    [/^Perform general office duties, such as filing/i, "Completed routine office tasks"],
    [/^Receive and count stock items/i, "Received and counted stock items"],
    [/^Receive, unload, open, unpack, or issue sales floor merchandise/i, "Received stock deliveries"],
    [/^Operate telephone switchboard to answer, screen, or forward calls/i, "Answered incoming calls and took messages"],
    [/^Greet persons entering establishment, determine nature and purpose of visit/i, "Greeted visitors and directed them to the right place"],
    [/^Receive payment (?:and record receipts|by cash, check)/i, "Processed payments"],
    [/^Schedule appointments and maintain and update appointment calendars/i, "Scheduled appointments and kept the calendar up to date"],
    [/^Hear and resolve complaints from customers or the public/i, "Resolved customer complaints"],
    [/^File and maintain records/i, "Filed documents and kept records up to date"],
    [/^Transmit information or documents to customers, using computer, mail/i, "Sent documents and information to customers"],
    [/^Provide information about establishment, such as location of departments/i, "Provided visitors with information about services and locations"],
    [/^Perform administrative support tasks, such as proofreading/i, "Checked documents for errors"],
    [/^Collect, sort, distribute, or prepare mail, messages, or courier deliveries/i, "Sorted and distributed mail or deliveries"],
    [/^Perform duties, such as taking care of plants or straightening magazines to maintain lobby or reception area/i, "Maintained a tidy reception area"],
  ];
  return pairs.find(([pattern]) => pattern.test(statement.trim()))?.[1] ?? null;
}
