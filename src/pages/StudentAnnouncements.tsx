import {
  Megaphone,
  ArrowLeft,
  CalendarDays,
  Pin,
} from "lucide-react";
import { Link } from "react-router-dom";

function StudentAnnouncements() {
  const announcements = [
    {
      title: "Mid-Term Examination Schedule",
      date: "August 18, 2026",
      category: "Examination",
      description:
        "The mid-term examination schedule has been published. Students are requested to review their examination dates and prepare accordingly.",
      important: true,
    },
    {
      title: "Assignment Submission Reminder",
      date: "August 20, 2026",
      category: "Academic",
      description:
        "Students are reminded to submit all pending assignments before the specified deadlines.",
      important: true,
    },
    {
      title: "Computer Lab Maintenance",
      date: "August 22, 2026",
      category: "Notice",
      description:
        "The computer laboratory will remain unavailable during the scheduled maintenance period.",
      important: false,
    },
    {
      title: "Semester Project Guidelines",
      date: "August 24, 2026",
      category: "Academic",
      description:
        "Semester project guidelines and submission requirements have been shared with students.",
      important: false,
    },
    {
      title: "Library Timing Update",
      date: "August 26, 2026",
      category: "General",
      description:
        "The library operating hours have been updated for the current semester.",
      important: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">

      <header className="bg-white border-b h-20 flex items-center justify-between px-6">

        <div className="flex items-center gap-4">

          <Link
            to="/student-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={22} />
          </Link>

          <div>

            <h1 className="text-2xl font-bold text-slate-800">
              Announcements
            </h1>

            <p className="text-sm text-slate-500">
              Important notices and updates
            </p>

          </div>

        </div>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          MA
        </div>

      </header>

      <main className="max-w-5xl mx-auto p-6">

        <div className="bg-orange-500 rounded-xl p-6 text-white mb-6">

          <div className="flex items-center gap-4">

            <div className="bg-white/20 p-3 rounded-lg">
              <Megaphone size={30} />
            </div>

            <div>

              <h2 className="text-2xl font-bold">
                Latest Announcements
              </h2>

              <p className="text-orange-100 mt-1">
                Stay updated with institutional notices.
              </p>

            </div>

          </div>

        </div>

        <div className="space-y-5">

          {announcements.map((announcement, index) => (

            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
            >

              <div className="flex gap-4">

                <div className="bg-orange-100 text-orange-600 p-3 rounded-lg h-fit">
                  <Megaphone size={23} />
                </div>

                <div className="flex-1">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <h3 className="text-lg font-bold text-slate-800">
                        {announcement.title}
                      </h3>

                      {announcement.important && (
                        <Pin
                          size={17}
                          className="text-red-500"
                        />
                      )}

                    </div>

                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {announcement.category}
                    </span>

                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">

                    <CalendarDays size={16} />

                    {announcement.date}

                  </div>

                  <p className="text-sm text-slate-600 leading-6 mt-4">
                    {announcement.description}
                  </p>

                </div>

              </div>

            </div>

          ))}

        </div>

      </main>

    </div>
  );
}

export default StudentAnnouncements;