-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 15, 2025 at 03:13 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `task_manager`
--

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
(2, 'HR', 'Human Resources Department', '2025-04-13 08:36:50', '2025-04-13 08:36:50'),
(4, 'Finance', 'Finance and Accounting Department', '2025-04-13 08:36:50', '2025-04-13 08:36:50'),
(6, 'PROJECT', '', '2025-04-14 14:39:04', '2025-04-14 14:39:04'),
(7, 'PURCAHSE', '', '2025-04-14 14:39:34', '2025-04-14 14:39:34'),
(8, 'MARKETING', '', '2025-04-14 14:40:16', '2025-04-14 14:40:16'),
(9, 'ADMIN', '', '2025-04-14 14:40:59', '2025-04-14 14:40:59'),
(10, 'DESPATCH', '', '2025-04-14 14:41:18', '2025-04-14 14:41:18'),
(11, 'DRIVER', '', '2025-04-14 14:41:34', '2025-04-14 14:41:34'),
(12, 'DESIGN', '  ', '2025-04-14 14:42:30', '2025-04-14 14:42:30'),
(13, 'ACCOUNTS ', ' ', '2025-04-15 05:38:32', '2025-04-15 05:38:32');

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('pending','in_progress','awaiting_approval','completed','cancelled','trashed') DEFAULT 'pending',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `due_date` date DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_deleted` tinyint(1) DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks_backup`
--

CREATE TABLE `tasks_backup` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('pending','in_progress','awaiting_approval','completed','cancelled') DEFAULT 'pending',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `due_date` date DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_deleted` tinyint(1) DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_assignments`
--

CREATE TABLE `task_assignments` (
  `id` int(11) NOT NULL,
  `task_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_by` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_comments`
--

CREATE TABLE `task_comments` (
  `id` int(11) NOT NULL,
  `task_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_history`
--

CREATE TABLE `task_history` (
  `id` int(11) NOT NULL,
  `task_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','employee') NOT NULL DEFAULT 'employee',
  `department_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `role`, `department_id`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'admin@example.com', 'admin123', 'admin', NULL, '2025-04-13 08:36:50', '2025-04-13 08:36:50'),
(4, 'admin1', 'admin@1.com', '$2b$10$mTfoe0p0ZzERm2uB.20xPOhHK056YBfywZRiU26dMsIvqcoCSvS6G', 'admin', NULL, '2025-04-13 13:24:19', '2025-04-13 13:24:19'),
(15, 'admin2', 'admin@2.com', '$2b$10$w/iN356AJW3oEVNX3.OznuwG2ymIUjY13qVTDrMfWBafEBVT6ZF4u', 'admin', NULL, '2025-04-13 21:38:42', '2025-04-13 21:38:42'),
(16, 'rakesh', 'rakesh@1.com', '$2b$10$ndlr2znzzZkd1FWufluNG.FvBF/PpJiHN7D3x8H4H04eA3XcwgHnG', 'admin', NULL, '2025-04-14 11:08:47', '2025-04-14 11:08:47'),
(18, 'SIDDARAJU T S', 'siddaraju@1.com', '$2b$10$E981mfyf/HO4Xk5cHy0fQuh9qGVQ0ZnFVUKfJnx3auWFxsWZ51/jq', 'employee', 6, '2025-04-14 14:44:33', '2025-04-14 14:44:33'),
(19, 'LALITHA', 'lalitha@1.com', '$2b$10$8A4NxNwxq4pe5djFfg/DruBThO0fNfF3M3yhJ28f7J00xiRnlNeae', 'employee', 7, '2025-04-15 05:06:14', '2025-04-15 05:06:14'),
(20, 'K SURESH', 'suresh@1.com', '$2b$10$Yge3auuSFohURCUjyqWNmu4.qv6v2w8csKILFAQNV2QuAjxUPX.Zu', 'employee', 8, '2025-04-15 05:07:52', '2025-04-15 05:07:52'),
(21, 'HARSHITA M H', 'harshita@1.com', '$2b$10$eCr9AEbcqkjTnBk9WARD0uGJ5gLlpoUf5B4ph8Z01QJOpqVdsNpRm', 'employee', 13, '2025-04-15 05:09:11', '2025-04-15 05:38:47'),
(22, 'ROOPA RAKESH KUMATAKAR', 'roopa@1.com', '$2b$10$MboSrtQWGol4W9FIH8L8P.5LDSY6BtU5YvbZVS2JmFCdyrYv1Mm8K', 'employee', 9, '2025-04-15 05:28:23', '2025-04-15 05:28:23'),
(23, 'PADMAJA G S', 'padmaja@1.com', '$2b$10$9y4fwAJYiAFbYWtHwbWUyuO7.hZCX348h69IfUaYsUKgx5rzQ7nrW', 'employee', 9, '2025-04-15 05:29:20', '2025-04-15 05:29:20'),
(24, 'BHUVANESH DEVARAKKI', 'bhuvanesh@1.com', '$2b$10$3VjcTp2oUy87qxIOSto4zed6N4hB4PyLqJfDJOSJ1WDBlCxeRqBG2', 'employee', 10, '2025-04-15 05:29:55', '2025-04-15 05:29:55'),
(25, 'RAVIRAJ S HIREMATH', 'raviraj@1.com', '$2b$10$saJsFcuKXW.S64zCJJC2ku2AlsH..GJ9t2LYjhboz3FeUoMHUF8xW', 'employee', 10, '2025-04-15 05:34:35', '2025-04-15 05:34:35'),
(26, 'MUNAVAR', 'munavar@1.com', '$2b$10$hR641ds0poJhdvMATLYzeOKZFMoX.DH8xoA6.XWikN1qT8nRSz76e', 'employee', 11, '2025-04-15 05:35:30', '2025-04-15 05:35:30'),
(27, 'LOKESH', 'lokesh@1.com', '$2b$10$TXz3wsM3iUAENCi3OcSxg.Xbq.mSZb1xhjaCRtgSeF.73RYI0AHbu', 'employee', 11, '2025-04-15 05:36:05', '2025-04-15 05:36:05'),
(28, 'SAMBHAVI HIREMATH', 'sambhavi@1.com', '$2b$10$FLV1V.oqhInl9cvtInSrXeA0KRwrsMXTji181fXyBh468wVzCKMlK', 'employee', 10, '2025-04-15 05:36:41', '2025-04-15 05:36:41'),
(29, 'A MADHAV VASANTHRAJ', 'madhav@1.com', '$2b$10$HvCMnyfiID1shxVglBML2ezKjJjGwSpKFGXVCl2byFEJZzLc6moE6', 'employee', 8, '2025-04-15 05:37:24', '2025-04-15 05:37:24'),
(30, 'CHAITHRA Y', 'chaithra@1.com', '$2b$10$s/pwt3P0d1mxz1ETcjMY9eGkxOzTcDbaPr2pJSaPTecBred5N19FO', 'employee', 13, '2025-04-15 05:38:16', '2025-04-15 05:39:14'),
(31, 'ABHISHEK BHAIRU PATIL', 'abhishek@1.com', '$2b$10$QS8.HbOFcxSUUd3xs.hjl.en0jU4EeklNtaelDgpHThvGVF8UjBfe', 'employee', 10, '2025-04-15 05:40:12', '2025-04-15 05:40:12'),
(32, 'PRAMOD NIMBALKAR', 'pramod@1.com', '$2b$10$cQll0XDh4/L4/8VtcQe3t.vLfQ4e9Nm19eE74Pq2ecUBygya/xIBC', 'employee', 13, '2025-04-15 05:40:52', '2025-04-15 05:40:52'),
(33, 'AKASH K C', 'akash@1.com', '$2b$10$xScNGdX605yj22E2aAbroe/4EPJsqnSN7GE0IeVZ9LvlGbe/Vrcgy', 'employee', 12, '2025-04-15 05:41:29', '2025-04-15 05:41:29'),
(34, 'Naveen Kumar M', 'naveen@1.com', '$2b$10$iERXJZexJkkXOCa0BhUCEuy.TId1bEryEUyjPLzp6NWgCRPgaUM26', 'employee', 12, '2025-04-15 05:43:25', '2025-04-15 05:43:25'),
(35, 'RAJESH MAHALE', 'rajesh@1.com', '$2b$10$JmVIqbAOtwCUMb38ZG7XyekqirE1CLwkDIpxTM8au9ZYD.AUNdpau', 'employee', 12, '2025-04-15 05:44:24', '2025-04-15 05:44:24'),
(36, 'PRASATH LOGANATHAN', 'prasath@1.com', '$2b$10$fu5I8SzpiwwFwDxm9KGNYu/tWB44naGeZBEIvmxq3TsUvylJ1DImi', 'employee', 12, '2025-04-15 05:45:14', '2025-04-15 05:45:14'),
(37, 'RESHMA B V', 'reshma@1.com', '$2b$10$4uGgatzjnt.QZLXnC/MUieijpJ0nUCRNyjgo1fzc36318.zsN/2EW', 'employee', 9, '2025-04-15 05:46:07', '2025-04-15 05:46:07'),
(38, 'RAVICHANDRA PATIL', 'ravichandra@1.com', '$2b$10$J8I4ulRL2Y1FoHMVWyycluk8hF3sUWjM3y3aozkGfpgaenLPAiPT6', 'employee', 12, '2025-04-15 05:48:43', '2025-04-15 05:48:43'),
(39, 'NAGAESWARAN P N', 'nagaeshwaran@1.com', '$2b$10$4I9Ce87vnwJPAO5pK5khFut.iYgm6LjjCl8v2ielH7ulKo2tJZ8PS', 'employee', 12, '2025-04-15 05:50:36', '2025-04-15 05:50:36'),
(40, 'HARSHANANDA V', 'harshananda@1.com', '$2b$10$8HOBaNn96j2RlHE7vaa2/.cNEUmFUv9eh8m2a3jpi4tZ7vwS7dHM.', 'employee', 7, '2025-04-15 05:53:31', '2025-04-15 05:53:31'),
(41, 'JOSHUA SHALOM D', 'joshua@1.com', '$2b$10$fNNUq0f4iw4/VCbA/4gaU.kCfcVH0pNvWr9zcXI1zUeNKw0AlKadG', 'employee', 9, '2025-04-15 05:54:09', '2025-04-15 05:54:09'),
(42, 'MADHU K M', 'madhu@1.com', '$2b$10$wxzFmtDiMt17uP6RNxHE/uyqwESMnzmlByNZqDsfZUXUwYhxtNV3e', 'employee', 12, '2025-04-15 05:54:46', '2025-04-15 05:54:46'),
(43, 'NISHAR ALAM KHAN', 'nishar@1.com', '$2b$10$Iv5SpG/D.95FhFh7aRCJiOqu4Va5zsgI2Fea8wjZ9bJhr5htA3kMS', 'employee', 12, '2025-04-15 05:55:30', '2025-04-15 05:55:30'),
(44, 'UPWAN DIXIT', 'upwan@1.com', '$2b$10$V8bxbN9e3zMOedBKMULj2ezN.JZW8JLY2T/3bN3PlcaxGYtVXMZdi', 'employee', 10, '2025-04-15 05:56:02', '2025-04-15 05:56:02'),
(45, 'BELTHASARA MOHANTA', 'belthasara@1.com', '$2b$10$GtoKoUWZ9Z8yDDe/uj7sNu.42r7oU5AhLvNyUbOtPlfns9lewAJhG', 'employee', 8, '2025-04-15 05:56:52', '2025-04-15 05:56:52'),
(46, 'MANO VIMAL S', 'mano@1.com', '$2b$10$3BfDwCn7tWK4ic0QL6FkpOPP22m0wJbu0yyQbOOu5VFbc5tLCy/.e', 'employee', 8, '2025-04-15 05:57:19', '2025-04-15 05:57:19'),
(47, 'SHREYAS THORAT', 'shreyas@1.com', '$2b$10$LjNjbDKHHk/W/8o/U4Jp2OasbU1hBYqA9QfE/e4ZsKD6D1Wm.XcTO', 'employee', 8, '2025-04-15 05:58:04', '2025-04-15 05:58:04'),
(48, 'MALIKARJUNA BASAVARAJ HITTANAGI', 'malikarjuna@1.com', '$2b$10$Zc3cCTJaN1MV.YTyv866vury7Ghkia9n6/O9yftMUszeV61GX2RKS', 'employee', 10, '2025-04-15 05:58:50', '2025-04-15 05:58:50'),
(49, 'CHITRASHREE S G', 'chitrashree@1.com', '$2b$10$kDxCu/v8HURUEzvJ7n84telcBl6Z7hUZbGD0wUpKkmObqy/ZktmV2', 'employee', 13, '2025-04-15 05:59:27', '2025-04-15 05:59:27'),
(50, 'ADARSH PARADESHI', 'adarsh@1.com', '$2b$10$UD76Htgxe6a33Gie2YCUJ.eJQvHdxHqiKTIFG8.9YcX/cC4io6UGO', 'employee', 7, '2025-04-15 06:00:02', '2025-04-15 06:00:02'),
(51, 'rakesh1', 'rakesh@12.com', '$2b$10$By07BSXKCtpqjdXEit5uxOf8VO387nPnt1L.GCd6veoVhjiPeFOBu', 'employee', 2, '2025-04-15 12:05:27', '2025-04-15 12:05:27'),
(52, 'pragami', 'pragami@1.com', '$2b$10$HOXicTZYptAB24APYExGneBeJDIDex/UmxbkubVC2fRHT9XO6nfey', 'admin', NULL, '2025-04-15 12:06:22', '2025-04-15 12:06:22');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `department_id` (`department_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `tasks_backup`
--
ALTER TABLE `tasks_backup`
  ADD PRIMARY KEY (`id`),
  ADD KEY `department_id` (`department_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `task_assignments`
--
ALTER TABLE `task_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_task_user` (`task_id`,`user_id`),
  ADD KEY `task_assignments_ibfk_2` (`user_id`),
  ADD KEY `task_assignments_ibfk_3` (`assigned_by`);

--
-- Indexes for table `task_comments`
--
ALTER TABLE `task_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_id` (`task_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `task_history`
--
ALTER TABLE `task_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_id` (`task_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `department_id` (`department_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `tasks_backup`
--
ALTER TABLE `tasks_backup`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `task_assignments`
--
ALTER TABLE `task_assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `task_comments`
--
ALTER TABLE `task_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `task_history`
--
ALTER TABLE `task_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tasks`
--
ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  ADD CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `task_assignments`
--
ALTER TABLE `task_assignments`
  ADD CONSTRAINT `task_assignments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  ADD CONSTRAINT `task_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `task_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
